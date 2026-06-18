import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { RoundStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'

async function requireAdmin(request: any, reply: any) {
  if ((request.user as any).role !== 'admin')
    return reply.status(403).send({ error: 'Admin access required' })
}

export async function adminRoundRoutes(app: FastifyInstance) {
  const preHandler = [app.authenticate, requireAdmin]

  // GET /api/admin/rounds  — all rounds with filters
  app.get('/rounds', { preHandler }, async (request, reply) => {
    const { shopId, status, from, to, page = 1 } = z.object({
      shopId: z.string().optional(),
      status: z.enum(['open','locked','settled','cancelled']).optional(),
      from:   z.string().optional(),
      to:     z.string().optional(),
      page:   z.coerce.number().default(1),
    }).parse(request.query)

    const limit = 25
    const where: any = {}
    if (shopId) where.shopId = shopId
    if (status) where.status = status
    if (from || to) {
      where.openedAt = {}
      if (from) where.openedAt.gte = new Date(from)
      if (to)   where.openedAt.lte = new Date(to + 'T23:59:59Z')
    }

    const [rounds, total] = await Promise.all([
      prisma.round.findMany({
        where,
        skip:  (page - 1) * limit,
        take:  limit,
        orderBy: { openedAt: 'desc' },
        include: {
          shop:  { select: { name: true } },
          staff: { select: { displayName: true } },
          _count: { select: { bets: true } },
        },
      }),
      prisma.round.count({ where }),
    ])

    return reply.send({
      data: rounds.map(r => ({
        id:         r.id,
        shopName:   r.shop.name,
        shopId:     r.shopId,
        staffName:  r.staff.displayName,
        status:     r.status,
        totalEven:  r.totalEven.toNumber(),
        totalOdd:   r.totalOdd.toNumber(),
        volume:     r.totalEven.toNumber() + r.totalOdd.toNumber(),
        result:     r.result,
        betCount:   r._count.bets,
        openedAt:   r.openedAt,
        settledAt:  r.settledAt,
        canVoid:    r.status === 'settled' && r.settledAt
          ? new Date().getTime() - new Date(r.settledAt).getTime() < 5 * 60 * 1000
          : false,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  })

  // GET /api/admin/rounds/stats  — aggregate stats
  // NOTE: must be registered BEFORE /rounds/:id to avoid being shadowed (BUG-07)
  app.get('/rounds/stats', { preHandler }, async (request, reply) => {
    const { shopId, days = 30 } = z.object({
      shopId: z.string().optional(),
      days:   z.coerce.number().default(30),
    }).parse(request.query)

    const since = new Date(Date.now() - days * 86400000)
    const where: any = { openedAt: { gte: since } }
    if (shopId) where.shopId = shopId

    const [total, settled, cancelled, openNow] = await Promise.all([
      prisma.round.count({ where }),
      prisma.round.count({ where: { ...where, status: 'settled' } }),
      prisma.round.count({ where: { ...where, status: 'cancelled' } }),
      prisma.round.count({ where: { status: { in: ['open', 'locked'] } } }),
    ])

    const volumeAgg = await prisma.round.aggregate({
      where: { ...where, status: 'settled' },
      _sum: { totalEven: true, totalOdd: true },
    })

    const evenVol = volumeAgg._sum.totalEven?.toNumber() ?? 0
    const oddVol  = volumeAgg._sum.totalOdd?.toNumber()  ?? 0
    const totalVol = evenVol + oddVol

    const [evenWins, oddWins] = await Promise.all([
      prisma.round.count({ where: { ...where, status: 'settled', result: 'even' } }),
      prisma.round.count({ where: { ...where, status: 'settled', result: 'odd'  } }),
    ])

    return reply.send({
      period: `${days} วัน`,
      totalRounds:  total,
      settledRounds:settled,
      cancelledRounds: cancelled,
      activeNow:    openNow,
      totalVolume:  totalVol,
      totalRevenue: totalVol * 0.10,
      evenWins, oddWins,
      evenWinRate: settled > 0 ? ((evenWins / settled) * 100).toFixed(1) : '0',
    })
  })

  // GET /api/admin/rounds/:id  — round detail with all bets
  app.get('/rounds/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const round = await prisma.round.findUniqueOrThrow({
      where: { id },
      include: {
        shop:  { select: { name: true, payoutRate: true } },
        staff: { select: { displayName: true, phone: true } },
        bets: {
          include: { user: { select: { displayName: true, phone: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const even = round.bets.filter(b => b.side === 'even')
    const odd  = round.bets.filter(b => b.side === 'odd')
    const totalVolume = round.totalEven.toNumber() + round.totalOdd.toNumber()

    return reply.send({
      id:        round.id,
      shopName:  round.shop.name,
      staffName: round.staff.displayName,
      staffPhone:round.staff.phone,
      status:    round.status,
      result:    round.result,
      totalEven: round.totalEven.toNumber(),
      totalOdd:  round.totalOdd.toNumber(),
      totalVolume,
      shopFee:   totalVolume * (1 - round.shop.payoutRate.toNumber()),
      openedAt:  round.openedAt,
      closedAt:  round.closedAt,
      settledAt: round.settledAt,
      canVoid:   round.status === 'settled' && round.settledAt
        ? new Date().getTime() - new Date(round.settledAt).getTime() < 5 * 60 * 1000
        : false,
      bets: round.bets.map(b => ({
        id:             b.id,
        side:           b.side,
        amountRequested:b.amountRequested.toNumber(),
        amountAccepted: b.amountAccepted.toNumber(),
        payout:         b.payout?.toNumber() ?? null,
        status:         b.status,
        user:           b.user,
        createdAt:      b.createdAt,
      })),
      summary: {
        evenBets:    even.length,
        oddBets:     odd.length,
        evenVolume:  even.reduce((s, b) => s + b.amountAccepted.toNumber(), 0),
        oddVolume:   odd.reduce((s, b) => s + b.amountAccepted.toNumber(), 0),
        winners:     round.bets.filter(b => b.status === 'won').length,
        losers:      round.bets.filter(b => b.status === 'lost').length,
        refunded:    round.bets.filter(b => b.status === 'refunded').length,
        totalPayout: round.bets.reduce((s, b) => s + (b.payout?.toNumber() ?? 0), 0),
      },
    })
  })

}
