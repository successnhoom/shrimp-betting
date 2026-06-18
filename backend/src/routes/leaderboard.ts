import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export async function leaderboardRoutes(app: FastifyInstance) {
  // GET /api/leaderboard?shopId=&period=today|week|month|all
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId, period = 'today', limit = 20 } = z.object({
      shopId: z.string().optional(),
      period: z.enum(['today', 'week', 'month', 'all']).default('today'),
      limit:  z.coerce.number().max(50).default(20),
    }).parse(request.query)

    const now = new Date()
    let since: Date | undefined
    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      since = new Date(now.getTime() - 7 * 86400000)
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const roundWhere: any = { status: 'settled' }
    if (shopId) roundWhere.shopId = shopId
    if (since)  roundWhere.settledAt = { gte: since }

    // Aggregate payout per user
    const payouts = await prisma.bet.groupBy({
      by: ['userId'],
      where: {
        status: 'won',
        round:  roundWhere,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { payout: true, amountAccepted: true },
      _count: { id: true },
      orderBy: { _sum: { payout: 'desc' } },
      take: limit,
    })

    // Enrich with user info
    const userIds = payouts.map(p => p.userId)
    const users   = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    return reply.send(
      payouts.map((p, idx) => ({
        rank:          idx + 1,
        userId:        p.userId,
        displayName:   userMap[p.userId]?.displayName ?? 'Unknown',
        totalPayout:   p._sum.payout?.toNumber() ?? 0,
        totalWagered:  p._sum.amountAccepted?.toNumber() ?? 0,
        wonBets:       p._count.id,
      }))
    )
  })
}
