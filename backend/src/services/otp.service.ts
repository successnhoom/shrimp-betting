import { prisma } from '../lib/prisma'
import { setOtp, getOtp, deleteOtp } from '../lib/redis'

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES || '5') * 60

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendSms(phone: string, code: string): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    // No Twilio configured — log OTP to console (dev/demo mode)
    console.log(`📱 OTP for ${phone}: ${code}`)
    return
  }

  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )

  await twilio.messages.create({
    body: `รหัส OTP ระบบตกกุ้ง: ${code} (หมดอายุใน ${OTP_EXPIRY / 60} นาที)`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: `+66${phone.replace(/^0/, '')}`,
  })
}

export async function sendOtp(phone: string): Promise<{ devCode?: string }> {
  const code = generateOtp()
  await setOtp(phone, code, OTP_EXPIRY)

  // Also store in DB for audit trail
  await prisma.otpCode.create({
    data: {
      phone,
      code,
      expiresAt: new Date(Date.now() + OTP_EXPIRY * 1000),
    },
  })

  try {
    await sendSms(phone, code)
  } catch (err: any) {
    console.error('SMS send failed:', err?.message || err)
    // Return devCode so user can still login even if SMS fails
    return { devCode: code }
  }

  // Return devCode if Twilio not configured (demo/dev mode)
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    return { devCode: code }
  }
  return {}
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const storedCode = await getOtp(phone)
  if (!storedCode || storedCode !== code) return false
  await deleteOtp(phone)
  return true
}
