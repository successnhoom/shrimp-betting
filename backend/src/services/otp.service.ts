import { prisma } from '../lib/prisma'
import { setOtp, getOtp, deleteOtp } from '../lib/redis'

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES || '5') * 60

function toE164(phone: string): string {
  return `+66${phone.replace(/^0/, '')}`
}

function hasVerify(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID)
}

export async function sendOtp(phone: string): Promise<void> {
  const to = toE164(phone)

  // ── Twilio Verify (production) ────────────────────────────
  if (hasVerify()) {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    try {
      await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications.create({ to, channel: 'sms' })
      console.log(`📱 Twilio Verify sent to ${to}`)
      return
    } catch (err: any) {
      console.error('Twilio Verify send failed:', err?.message || err)
      // In production, fail hard — never fall through to devCode mode
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ไม่สามารถส่ง OTP ได้ในขณะนี้ กรุณาลองใหม่')
      }
      // In dev/test, fall through to local code mode
    }
  }

  // ── Dev / local mode only ─────────────────────────────────
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  await setOtp(phone, code, OTP_EXPIRY)

  await prisma.otpCode.create({
    data: { phone, code, expiresAt: new Date(Date.now() + OTP_EXPIRY * 1000) },
  })

  // SEC-09 fix: log to server console only, never return in HTTP response
  console.log(`📱 [DEV] OTP for ${phone}: ${code}`)
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const to = toE164(phone)

  // ── Twilio Verify (production) ────────────────────────────
  if (hasVerify()) {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    try {
      const check = await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks.create({ to, code })
      return check.status === 'approved'
    } catch (err: any) {
      console.error('Twilio Verify check failed:', err?.message || err)
      // Fall through to Redis check
    }
  }

  // ── Dev / fallback mode ───────────────────────────────────
  const storedCode = await getOtp(phone)
  if (!storedCode || storedCode !== code) return false
  await deleteOtp(phone)
  return true
}
