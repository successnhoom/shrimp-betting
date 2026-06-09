import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { addDeposit } from '../services/wallet.service'
import {
  sendDepositNotification,
  updateDepositMessage,
  answerCallback,
  setWebhook,
  isTelegramConfigured,
} from '../services/telegram.service'

export async function depositRoutes(app: FastifyInstance) {

  // GET /api/deposit/qr — get shop PromptPay QR image (public)
  app.get('/qr', async (_req, reply) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'promptpay_qr' } })
    if (!setting?.value) return reply.status(404).send({ error: 'QR not configured' })
    return reply.send({ qrBase64: setting.value })
  })

  // POST /api/deposit/qr — admin uploads QR image
  app.post('/qr', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role } = request.user as { role: string }
    if (!['admin'].includes(role)) return reply.status(403).send({ error: 'Forbidden' })

    const { qrBase64 } = z.object({ qrBase64: z.string().min(100) }).parse(request.body)

    await prisma.appSetting.upsert({
      where:  { key: 'promptpay_qr' },
      update: { value: qrBase64 },
      create: { key: 'promptpay_qr', value: qrBase64 },
    })
    return reply.send({ message: 'QR updated' })
  })

  // POST /api/deposit/request — customer submits deposit + optional slip
  app.post('/request', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { amount, slipBase64, slipMime } = z.object({
      amount:      z.number().min(20).max(500000),
      slipBase64:  z.string().optional(),
      slipMime:    z.string().optional(),
    }).parse(request.body)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    // Create pending deposit request
    const req = await prisma.depositRequest.create({
      data: { userId, amount, slipUrl: slipBase64 ? 'base64' : null },
    })

    // Send Telegram notification
    const msgId = await sendDepositNotification({
      requestId:   req.id,
      userPhone:   user.phone,
      displayName: user.displayName,
      amount,
      slipBase64,
      slipMime,
    })

    // Save telegram message id for later editing
    if (msgId) {
      await prisma.depositRequest.update({
        where: { id: req.id },
        data:  { telegramMsgId: msgId },
      })
    }

    return reply.send({
      requestId: req.id,
      message: isTelegramConfigured()
        ? 'ส่งคำขอแล้ว รอแอดมินอนุมัติ'
        : 'ส่งคำขอแล้ว (Telegram ยังไม่ได้ตั้งค่า — แอดมินจะเห็นในหน้า admin)',
    })
  })

  // GET /api/deposit/requests — admin list pending requests
  app.get('/requests', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role } = request.user as { role: string }
    if (!['admin', 'staff'].includes(role)) return reply.status(403).send({ error: 'Forbidden' })

    const { status = 'pending' } = z.object({
      status: z.string().optional(),
    }).parse(request.query)

    const requests = await prisma.depositRequest.findMany({
      where:   { status },
      include: { user: { select: { phone: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    return reply.send(requests.map(r => ({
      id:          r.id,
      amount:      r.amount.toNumber(),
      status:      r.status,
      hasSlip:     !!r.slipUrl,
      note:        r.note,
      createdAt:   r.createdAt,
      user:        r.user,
    })))
  })

  // POST /api/deposit/approve/:id — admin approves via web
  app.post('/approve/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role, userId: adminId } = request.user as { role: string; userId: string }
    if (!['admin', 'staff'].includes(role)) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    const req = await prisma.depositRequest.findUniqueOrThrow({ where: { id } })
    if (req.status !== 'pending') return reply.status(400).send({ error: 'Already processed' })

    await prisma.depositRequest.update({
      where: { id },
      data:  { status: 'approved', processedAt: new Date() },
    })
    await addDeposit(req.userId, req.amount.toNumber(), `deposit-${id}`)

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { displayName: true } })
    if (req.telegramMsgId) {
      await updateDepositMessage(req.telegramMsgId, 'approved', req.amount.toNumber(), admin?.displayName)
    }

    return reply.send({ message: 'Approved', amount: req.amount.toNumber() })
  })

  // POST /api/deposit/reject/:id — admin rejects via web
  app.post('/reject/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role, userId: adminId } = request.user as { role: string; userId: string }
    if (!['admin', 'staff'].includes(role)) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    const req = await prisma.depositRequest.findUniqueOrThrow({ where: { id } })
    if (req.status !== 'pending') return reply.status(400).send({ error: 'Already processed' })

    await prisma.depositRequest.update({
      where: { id },
      data:  { status: 'rejected', processedAt: new Date() },
    })

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { displayName: true } })
    if (req.telegramMsgId) {
      await updateDepositMessage(req.telegramMsgId, 'rejected', req.amount.toNumber(), admin?.displayName)
    }

    return reply.send({ message: 'Rejected' })
  })

  // POST /api/deposit/telegram-webhook — Telegram callback handler
  app.post('/telegram-webhook', async (request, reply) => {
    const body = request.body as any
    const cb   = body?.callback_query
    if (!cb) return reply.send({ ok: true })

    const [action, requestId] = (cb.data as string).split(':')
    if (!requestId) return reply.send({ ok: true })

    try {
      const req = await prisma.depositRequest.findUnique({ where: { id: requestId } })
      if (!req || req.status !== 'pending') {
        await answerCallback(cb.id, '⚠️ คำขอนี้ถูกดำเนินการแล้ว')
        return reply.send({ ok: true })
      }

      if (action === 'approve') {
        await prisma.depositRequest.update({
          where: { id: requestId },
          data:  { status: 'approved', processedAt: new Date() },
        })
        await addDeposit(req.userId, req.amount.toNumber(), `tg-${requestId}`)
        await answerCallback(cb.id, `✅ อนุมัติ ${req.amount.toNumber().toLocaleString()} ฿ แล้ว`)
        if (req.telegramMsgId) {
          await updateDepositMessage(req.telegramMsgId, 'approved', req.amount.toNumber(), cb.from?.first_name)
        }
      } else if (action === 'reject') {
        await prisma.depositRequest.update({
          where: { id: requestId },
          data:  { status: 'rejected', processedAt: new Date() },
        })
        await answerCallback(cb.id, '❌ ปฏิเสธแล้ว')
        if (req.telegramMsgId) {
          await updateDepositMessage(req.telegramMsgId, 'rejected', req.amount.toNumber(), cb.from?.first_name)
        }
      }
    } catch (err) {
      console.error('[Telegram webhook]', err)
      await answerCallback(cb.id, '⚠️ เกิดข้อผิดพลาด')
    }

    return reply.send({ ok: true })
  })

  // POST /api/deposit/setup-telegram — admin sets up Telegram webhook
  app.post('/setup-telegram', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role } = request.user as { role: string }
    if (role !== 'admin') return reply.status(403).send({ error: 'Forbidden' })

    const { baseUrl } = z.object({ baseUrl: z.string().url() }).parse(request.body)
    const webhookUrl = `${baseUrl}/api/deposit/telegram-webhook`
    const result = await setWebhook(webhookUrl)
    return reply.send(result)
  })
}
