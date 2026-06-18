import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function shopRoutes(app: FastifyInstance) {
  // GET /api/shops/:shopId  — public shop info (for QR scan landing)
  app.get('/:shopId', async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: shopId, isActive: true },
      select: { id: true, name: true, payoutRate: true },
    })
    return reply.send(shop)
  })

  // GET /api/shops/:shopId/tables
  app.get('/:shopId/tables', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const tables = await prisma.table.findMany({
      where: { shopId },
      orderBy: { tableNumber: 'asc' },
    })
    return reply.send(tables)
  })
}
