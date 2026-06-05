import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export async function analyticsRoutes(app: FastifyInstance) {
  // ── GET /api/analytics/volume  — hourly volume for last 24h ──────────────
  app.get('/volume', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId } = z.object({ shopId: z.string().optional() }).parse(request.query)

    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const rounds = await prisma.round.findMany({
      where: {
        status: 'settled',
        settledAt: { gte: since },
        ...(shopId ? { shopId } : {}),
      },
      select: { settledAt: true, totalEven: true, totalOdd: true },
    })

    // Bucket by hour
    const byHour: Record<number, { volume: number; rounds: number }> = {}
    for (let h = 0; h < 24; h++) byHour[h] = { volume: 0, rounds: 0 }

    for (const r of rounds) {
      const hour = r.settledAt!.getHours()
      byHour[hour].volume += r.totalEven.toNumber() + r.totalOdd.toNumber()
      byHour[hour].rounds++
    }

    return reply.send(
      Object.entries(byHour).map(([h, d]) => ({
        hour:   parseInt(h),
        label:  `${h.toString().padStart(2,'0')}:00`,
        volume: d.volume,
        rounds: d.rounds,
        fee:    d.volume * 0.10,
      }))
    )
  })

  // ── GET /api/analytics/daily  — daily stats for last N days ──────────────
  app.get('/daily', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId, days = 14 } = z.object({
      shopId: z.string().optional(),
      days:   z.coerce.number().default(14),
    }).parse(request.query)

    const since = new Date(Date.now() - days * 86400000)
    const rounds = await prisma.round.findMany({
      where: {
        status: 'settled',
        settledAt: { gte: since },
        ...(shopId ? { shopId } : {}),
      },
      select: { settledAt: true, totalEven: true, totalOdd: true, result: true },
    })

    const byDay: Record<string, { volume: number; rounds: number; evenWins: number; oddWins: number }> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      byDay[d.toISOString().split('T')[0]] = { volume: 0, rounds: 0, evenWins: 0, oddWins: 0 }
    }

    for (const r of rounds) {
      const day = r.settledAt!.toISOString().split('T')[0]
      if (!byDay[day]) continue
      byDay[day].volume += r.totalEven.toNumber() + r.totalOdd.toNumber()
      byDay[day].rounds++
      if (r.result === 'even') byDay[day].evenWins++
      if (r.result === 'odd')  byDay[day].oddWins++
    }

    return reply.send(
      Object.entries(byDay).map(([date, d]) => ({
        date, ...d, fee: d.volume * 0.10,
      }))
    )
  })

  // ── GET /api/analytics/top-bettors  — top 10 by volume ───────────────────
  app.get('/top-bettors', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId, days = 30 } = z.object({
      shopId: z.string().optional(),
      days:   z.coerce.number().default(30),
    }).parse(request.query)

    const since = new Date(Date.now() - days * 86400000)
    const roundWhere = shopId ? { shopId, status: 'settled' } : { status: 'settled' }

    const agg = await prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since }, round: roundWhere },
      _sum:   { amountAccepted: true, payout: true },
      _count: { id: true },
      orderBy: { _sum: { amountAccepted: 'desc' } },
      take: 10,
    })

    const users = await prisma.user.findMany({
      where: { id: { in: agg.map(a => a.userId) } },
      select: { id: true, displayName: true },
    })
    const uMap = Object.fromEntries(users.map(u => [u.id, u.displayName]))

    return reply.send(agg.map((a, i) => ({
      rank:        i + 1,
      displayName: uMap[a.userId] ?? '–',
      totalWagered:a._sum.amountAccepted?.toNumber() ?? 0,
      totalPayout: a._sum.payout?.toNumber() ?? 0,
      betCount:    a._count.id,
      netProfit:   (a._sum.payout?.toNumber() ?? 0) - (a._sum.amountAccepted?.toNumber() ?? 0),
    })))
  })

  // ── GET /api/analytics/even-odd  — win rate even vs odd over time ─────────
  app.get('/even-odd', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId, days = 30 } = z.object({
      shopId: z.string().optional(),
      days:   z.coerce.number().default(30),
    }).parse(request.query)

    const since = new Date(Date.now() - days * 86400000)
    const [even, odd, total] = await Promise.all([
      prisma.round.count({ where: { status: 'settled', result: 'even', settledAt: { gte: since }, ...(shopId ? { shopId } : {}) } }),
      prisma.round.count({ where: { status: 'settled', result: 'odd',  settledAt: { gte: since }, ...(shopId ? { shopId } : {}) } }),
      prisma.round.count({ where: { status: 'settled', settledAt: { gte: since }, ...(shopId ? { shopId } : {}) } }),
    ])

    return reply.send({
      total, even, odd,
      evenPct: total > 0 ? parseFloat(((even / total) * 100).toFixed(1)) : 50,
      oddPct:  total > 0 ? parseFloat(((odd  / total) * 100).toFixed(1)) : 50,
    })
  })
}
