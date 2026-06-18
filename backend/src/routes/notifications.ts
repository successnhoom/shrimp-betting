import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export async function notificationRoutes(app: FastifyInstance) {
  // GET /api/notifications  — paginated inbox
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { page = 1, unreadOnly = false } = z.object({
      page:       z.coerce.number().default(1),
      unreadOnly: z.coerce.boolean().default(false),
    }).parse(request.query)

    const limit = 30
    const where: any = { userId }
    if (unreadOnly) where.isRead = false

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ])

    return reply.send({
      data: items.map(n => ({
        id:        n.id,
        type:      n.type,
        title:     n.title,
        body:      n.body,
        data:      n.data,
        isRead:    n.isRead,
        createdAt: n.createdAt,
      })),
      total,
      page,
      totalPages:  Math.ceil(total / limit),
      unreadCount,
    })
  })

  // GET /api/notifications/unread-count  — badge count only
  app.get('/unread-count', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const count = await prisma.notification.count({ where: { userId, isRead: false } })
    return reply.send({ count })
  })

  // PATCH /api/notifications/:id/read  — mark one as read
  app.patch('/:id/read', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id }     = request.params as { id: string }
    await prisma.notification.updateMany({
      where: { id, userId },
      data:  { isRead: true },
    })
    return reply.send({ ok: true })
  })

  // PATCH /api/notifications/read-all  — mark all as read
  app.patch('/read-all', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { count } = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    })
    return reply.send({ marked: count })
  })

  // DELETE /api/notifications/:id  — delete one
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id }     = request.params as { id: string }
    await prisma.notification.deleteMany({ where: { id, userId } })
    return reply.send({ ok: true })
  })

  // DELETE /api/notifications  — clear all read
  app.delete('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { count }  = await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    })
    return reply.send({ deleted: count })
  })
}
