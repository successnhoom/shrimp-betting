import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function registerErrorHandler(app: any) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Zod validation errors → 400
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation error',
        issues: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
      })
    }

    // Prisma not found → 404
    if (error.message?.includes('No') && error.message?.includes('found')) {
      return reply.status(404).send({ error: 'Not found' })
    }

    // Prisma unique constraint → 409
    if ((error as any).code === 'P2002') {
      return reply.status(409).send({ error: 'Already exists' })
    }

    // JWT errors → 401
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Rate limit → pass through
    if (reply.statusCode === 429) return reply.send(error)

    // Log unexpected errors
    request.log.error({ err: error, url: request.url, method: request.method })

    return reply.status(500).send({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    })
  })

  // Handle 404 routes
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({ error: `Route ${request.method} ${request.url} not found` })
  })
}
