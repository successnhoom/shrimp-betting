import pino from 'pino'
import { randomUUID } from 'crypto'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
  base: { service: 'shrimp-betting-api' },
})

/** Attach request ID to every request for tracing */
export function registerRequestLogger(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const reqId = (request.headers['x-request-id'] as string) || randomUUID()
    ;(request as any).reqId = reqId
    request.log = request.log.child({ reqId })
  })

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const { method, url } = request
    const status    = reply.statusCode
    const ms        = reply.getResponseTime().toFixed(0)
    const userId    = (request as any).user?.userId || 'anon'

    if (url === '/health' || url === '/health/ready') return // skip health spam

    request.log.info({ method, url, status, ms: `${ms}ms`, userId })
  })
}
