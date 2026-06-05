import { FastifyInstance } from 'fastify'
import { prisma } from './prisma'
import { redis } from './redis'

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {}

    // DB
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch { checks.database = 'fail' }

    // Redis
    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch { checks.redis = 'fail' }

    const allOk = Object.values(checks).every(v => v === 'ok')
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })
  })

  app.get('/health/ready', async (_req, reply) => {
    return reply.send({ ready: true })
  })
}
