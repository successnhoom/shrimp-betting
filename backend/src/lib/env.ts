/**
 * Environment variable validation — fails fast on startup if required vars are missing
 */
import { z } from 'zod'

const envSchema = z.object({
  // Server
  NODE_ENV:  z.enum(['development', 'production', 'test']).default('development'),
  PORT:      z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET:    z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // App config
  APP_URL:                   z.string().default('http://localhost:3000'),
  OTP_EXPIRY_MINUTES:        z.coerce.number().default(5),
  ROUND_DURATION_SECONDS:    z.coerce.number().default(180),
  BALANCE_CUT_WINDOW_SECONDS:z.coerce.number().default(30),
  PAYOUT_RATE:               z.coerce.number().min(0.5).max(0.99).default(0.90),
  PROMPTPAY_PHONE:           z.string().default('0800000000'),

  // Optional services
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN:  z.string().optional(),
  TWILIO_PHONE_NUMBER:z.string().optional(),
  STRIPE_SECRET_KEY:  z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN:         z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env

export function validateEnv(): Env {
  if (_env) return _env

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    result.error.errors.forEach(e => {
      console.error(`   ${e.path.join('.')}: ${e.message}`)
    })
    process.exit(1)
  }

  // Warn about missing optional services
  const data = result.data
  if (data.NODE_ENV === 'production') {
    if (!data.STRIPE_SECRET_KEY)   console.warn('⚠️  STRIPE_SECRET_KEY not set — payments disabled')
    if (!data.TWILIO_ACCOUNT_SID)  console.warn('⚠️  TWILIO_ACCOUNT_SID not set — SMS disabled')
    if (!data.SENTRY_DSN)          console.warn('⚠️  SENTRY_DSN not set — error tracking disabled')
    if (data.JWT_SECRET === 'change-this-secret-in-production') {
      console.error('❌ JWT_SECRET must be changed in production!')
      process.exit(1)
    }
  }

  _env = data
  console.log(`✅ Environment validated (${data.NODE_ENV})`)
  return _env
}

export function getEnv(): Env {
  if (!_env) return validateEnv()
  return _env
}
