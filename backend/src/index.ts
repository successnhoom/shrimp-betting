import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { createServer } from 'http'
import { initSocket } from './lib/socket'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'
import { registerHealthRoutes } from './lib/health'
import { registerErrorHandler } from './lib/errors'
import { registerHelmet } from './lib/helmet'
import { initSentry } from './lib/sentry'
import { validateEnv } from './lib/env'
import { registerRequestLogger } from './lib/logger'

import { authRoutes } from './routes/auth'
import { walletRoutes } from './routes/wallet'
import { roundRoutes } from './routes/rounds'
import { staffRoutes } from './routes/staff'
import { shopRoutes } from './routes/shops'
import { adminRoutes } from './routes/admin'
import { qrRoutes } from './routes/qr'
import { profileRoutes } from './routes/profile'
import { leaderboardRoutes } from './routes/leaderboard'
import { adminRoundRoutes } from './routes/admin.rounds'
import { analyticsRoutes }     from './routes/analytics'
import { notificationRoutes } from './routes/notifications'
import { depositRoutes } from './routes/deposit'

// Start background workers (wrapped to prevent crash if Redis unavailable)
try {
  require('./jobs/round.jobs')
  require('./jobs/notification.jobs')
  console.log('✅ Background workers started')
} catch (err) {
  console.error('⚠️ Background workers failed (non-fatal):', err)
}

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
})

async function bootstrap() {
  // ── Plugins ─────────────────────────────────────────────
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000']

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      if (process.env.NODE_ENV !== 'production') return cb(null, true)
      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req: any) => {
      const user = (req as any).user
      return user?.userId || req.ip
    },
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่',
    }),
  })

  // ── Auth decorator ───────────────────────────────────────
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ── Raw body for Stripe webhooks ─────────────────────────
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    ;(req as any).rawBody = body
    try {
      done(null, JSON.parse(body.toString()))
    } catch (err: any) {
      done(err, undefined)
    }
  })

  // ── Error handler ────────────────────────────────────────
  registerHelmet(app)
  registerErrorHandler(app)
  registerRequestLogger(app)

  // ── Health routes ────────────────────────────────────────
  await registerHealthRoutes(app)

  // ── API Routes ───────────────────────────────────────────
  await app.register(authRoutes,   { prefix: '/api/auth' })
  await app.register(walletRoutes, { prefix: '/api/wallet' })
  await app.register(roundRoutes,  { prefix: '/api' })
  await app.register(staffRoutes,  { prefix: '/api/staff' })
  await app.register(shopRoutes,   { prefix: '/api/shops' })
  await app.register(adminRoutes,  { prefix: '/api/admin' })
  await app.register(qrRoutes,        { prefix: '/api/qr' })
  await app.register(profileRoutes,  { prefix: '/api/profile' })
  await app.register(leaderboardRoutes,  { prefix: '/api/leaderboard' })
  await app.register(adminRoundRoutes,    { prefix: '/api/admin' })
  await app.register(analyticsRoutes,      { prefix: '/api/analytics' })
  await app.register(notificationRoutes,   { prefix: '/api/notifications' })
  await app.register(depositRoutes,        { prefix: '/api/deposit' })

  // ── Socket.io ────────────────────────────────────────────
  const httpServer = createServer(app.server as any)
  initSocket(httpServer)

  // ── Connect services ─────────────────────────────────────
  await prisma.$connect()
  await redis.connect()

  const port = parseInt(process.env.PORT || '3001')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🦐 Shrimp Betting API running on port ${port}`)
  console.log(`   ENV: ${process.env.NODE_ENV}`)
}

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...')
  await app.close()
  await prisma.$disconnect()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

validateEnv()
initSentry()
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
