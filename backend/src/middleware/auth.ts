import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply)
    // BUG-01 fix: stop if authenticate already sent a 401
    if (reply.sent) return
    const user = request.user as { userId: string; role: string }
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}

// Attach full user to request
export async function attachUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { wallet: true },
    })
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'User not found or disabled' })
    }
    ;(request as any).currentUser = user
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}
