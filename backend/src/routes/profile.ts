import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export async function profileRoutes(app: FastifyInstance) {
  // GET /api/profile/stats  — personal stats
  app.get('/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    const [bets, wallet] = await Promise.all([
      prisma.bet.findMany({
        where: { userId },
        select: { side: true, amountAccepted: true, payout: true, status: true, createdAt: true },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
    ])

    const won   = bets.filter(b => b.status === 'won')
    const lost  = bets.filter(b => b.status === 'lost')
    const total = won.length + lost.length

    const totalWagered  = bets.reduce((s, b) => s + b.amountAccepted.toNumber(), 0)
    const totalPayout   = won.reduce((s, b) => s + (b.payout?.toNumber() ?? 0), 0)
    const winRate       = total > 0 ? (won.length / total) * 100 : 0
    const netProfit     = totalPayout - totalWagered

    // Streak
    const sorted = [...bets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    let currentStreak = 0
    let streakType: 'win' | 'loss' | null = null
    for (const b of sorted) {
      if (b.status !== 'won' && b.status !== 'lost') continue
      const isWin = b.status === 'won'
      if (streakType === null) { streakType = isWin ? 'win' : 'loss'; currentStreak = 1 }
      else if ((streakType === 'win') === isWin) currentStreak++
      else break
    }

    // Favourite side
    const evenBets = bets.filter(b => b.side === 'even').length
    const oddBets  = bets.filter(b => b.side === 'odd').length

    return reply.send({
      balance:        wallet?.balance.toNumber() ?? 0,
      lockedAmount:   wallet?.lockedAmount.toNumber() ?? 0,
      totalBets:      bets.length,
      wonBets:        won.length,
      lostBets:       lost.length,
      winRate:        parseFloat(winRate.toFixed(1)),
      totalWagered,
      totalPayout,
      netProfit,
      currentStreak,
      streakType,
      favouriteSide:  evenBets >= oddBets ? 'even' : 'odd',
    })
  })

  // GET /api/profile/bets  — paginated bet history
  app.get('/bets', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { page = 1, status, side } = z.object({
      page:   z.coerce.number().default(1),
      status: z.string().optional(),
      side:   z.enum(['even', 'odd']).optional(),
    }).parse(request.query)

    const limit = 20
    const where: any = { userId }
    if (status) where.status = status
    if (side)   where.side   = side

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { round: { select: { shopId: true, openedAt: true, result: true, shop: { select: { name: true } } } } },
      }),
      prisma.bet.count({ where }),
    ])

    return reply.send({
      data: bets.map(b => ({
        id:              b.id,
        side:            b.side,
        amountRequested: b.amountRequested.toNumber(),
        amountAccepted:  b.amountAccepted.toNumber(),
        payout:          b.payout?.toNumber() ?? null,
        status:          b.status,
        createdAt:       b.createdAt,
        round: {
          id:       b.roundId,
          result:   b.round.result,
          shopName: b.round.shop.name,
          openedAt: b.round.openedAt,
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  })

  // GET /api/profile/me  — update display name
  app.patch('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { displayName } = z.object({
      displayName: z.string().min(1).max(100),
    }).parse(request.body)

    const user = await prisma.user.update({
      where: { id: userId },
      data:  { displayName },
      select: { id: true, phone: true, displayName: true, role: true },
    })
    return reply.send(user)
  })
}
