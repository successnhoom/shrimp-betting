import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendOtp, verifyOtp } from '../services/otp.service'
import { setPhoneVerified, checkAndClearPhoneVerified } from '../lib/redis'

const sendOtpSchema  = z.object({ phone: z.string().min(9).max(15) })
const verifyOtpSchema = z.object({ phone: z.string(), code: z.string().length(6) })
const registerSchema  = z.object({
  phone:       z.string().min(9).max(15),
  displayName: z.string().min(1).max(100),
})

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/send-otp
  app.post('/send-otp', async (request, reply) => {
    const { phone } = sendOtpSchema.parse(request.body)
    const result = await sendOtp(phone)
    return reply.send({ message: 'OTP sent', ...result })
  })

  // POST /api/auth/login  (existing user)
  app.post('/login', async (request, reply) => {
    const { phone, code } = verifyOtpSchema.parse(request.body)

    const valid = await verifyOtp(phone, code)
    if (!valid) return reply.status(400).send({ error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' })

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      // OTP valid แต่ยังไม่มี account — เก็บ flag ใน Redis 5 นาที
      await setPhoneVerified(phone)
      return reply.status(404).send({ error: 'ยังไม่มีบัญชี กรุณาสมัครสมาชิก' })
    }
    if (!user.isActive) return reply.status(403).send({ error: 'บัญชีถูกระงับ' })

    const token = app.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )
    return reply.send({
      token,
      user: { id: user.id, phone: user.phone, displayName: user.displayName, role: user.role },
    })
  })

  // POST /api/auth/register  (new user) — ต้องผ่าน login ก่อน (OTP verified)
  app.post('/register', async (request, reply) => {
    const { phone, displayName } = registerSchema.parse(request.body)

    // ตรวจว่า phone นี้เพิ่ง verify OTP ผ่านมาหรือยัง (Redis flag)
    const verified = await checkAndClearPhoneVerified(phone)
    if (!verified) {
      return reply.status(400).send({ error: 'กรุณายืนยัน OTP ก่อนสมัคร หรือ OTP หมดอายุแล้ว' })
    }

    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) return reply.status(409).send({ error: 'เบอร์นี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ' })

    const user = await prisma.user.create({
      data: {
        phone,
        displayName,
        wallet: { create: { balance: 0 } },
      },
    })

    const token = app.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )
    return reply.status(201).send({
      token,
      user: { id: user.id, phone: user.phone, displayName: user.displayName, role: user.role },
    })
  })

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { wallet: true },
    })
    return reply.send({
      id:          user.id,
      phone:       user.phone,
      displayName: user.displayName,
      role:        user.role,
      wallet: user.wallet ? {
        balance:      user.wallet.balance.toNumber(),
        lockedAmount: user.wallet.lockedAmount.toNumber(),
      } : null,
    })
  })
}
