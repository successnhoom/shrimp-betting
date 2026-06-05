import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BetSide } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { placeBet, getCurrentRound } from '../services/round.service'
import { betRateLimit } from '../middleware/rateLimiter'

export async function roundRoutes(app: FastifyInstance) {
  // GET /api/shops/:shopId/round/current
  app.get('/shops/:shopId/round/current', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const { userId } = request.user as { userId: string }

    let round = await getCurrentRound(shopId)

    // If no active round, also check if one was recently settled (within 30s)
    // so the customer can see the result
    if (!round) {
      const recent = await prisma.round.findFirst({
        where: {
          shopId,
          status: { in: ['settled', 'cancelled'] },
          settledAt: { gte: new Date(Date.now() - 30_000) },
        },
        orderBy: { settledAt: 'desc' },
      })
      if (recent) round = recent as any
    }

    if (!round) return reply.send({ round: null })

    // Get user's bets for this round
    const myBets = await prisma.bet.findMany({
      where: { roundId: round.id, userId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({
      round: {
        id: round.id,
        status: round.status,
        totalEven: round.totalEven.toNumber(),
        totalOdd: round.totalOdd.toNumber(),
        openedAt: round.openedAt,
        closedAt: round.closedAt,
        result: round.result,
      },
      myBets: myBets.map(b => ({
        id: b.id,
        side: b.side,
        amountRequested: b.amountRequested.toNumber(),
        amountAccepted: b.amountAccepted.toNumber(),
        payout: b.payout?.toNumber(),
        status: b.status,
        createdAt: b.createdAt,
      })),
    })
  })

  // POST /api/rounds/:roundId/bets  — place a bet
  app.post('/rounds/:roundId/bets', { preHandler: [app.authenticate, betRateLimit] }, async (request, reply) => {
    const { roundId } = request.params as { roundId: string }
    const { userId } = request.user as { userId: string }
    const { side, amount } = z.object({
      side: z.enum(['even', 'odd']),
      amount: z.number().min(10).max(100000),
    }).parse(request.body)

    try {
      const bet = await placeBet(roundId, userId, side as BetSide, amount)
      return reply.status(201).send({
        betId: bet.id,
        side: bet.side,
        amountRequested: bet.amountRequested.toNumber(),
        amountAccepted: bet.amountAccepted.toNumber(),
        status: bet.status,
      })
    } catch (err: any) {
      if (err.message === 'ROUND_NOT_OPEN') return reply.status(400).send({ error: 'Round is not open for betting' })
      if (err.message === 'INSUFFICIENT_BALANCE') return reply.status(400).send({ error: 'Insufficient balance' })
      throw err
    }
  })

  // GET /api/rounds/:roundId/bets/my
  app.get('/rounds/:roundId/bets/my', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { roundId } = request.params as { roundId: string }
    const { userId } = request.user as { userId: string }

    const bets = await prisma.bet.findMany({
      where: { roundId, userId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(bets.map(b => ({
      id: b.id,
      side: b.side,
      amountRequested: b.amountRequested.toNumber(),
      amountAccepted: b.amountAccepted.toNumber(),
      payout: b.payout?.toNumber(),
      status: b.status,
      createdAt: b.createdAt,
    })))
  })

  // GET /api/rounds/:roundId  — round detail
  app.get('/rounds/:roundId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { roundId } = request.params as { roundId: string }

    const round = await prisma.round.findUniqueOrThrow({
      where: { id: roundId },
      include: {
        _count: { select: { bets: true } },
      },
    })

    return reply.send({
      id: round.id,
      shopId: round.shopId,
      status: round.status,
      totalEven: round.totalEven.toNumber(),
      totalOdd: round.totalOdd.toNumber(),
      result: round.result,
      openedAt: round.openedAt,
      closedAt: round.closedAt,
      settledAt: round.settledAt,
      betCount: round._count.bets,
    })
  })
}
