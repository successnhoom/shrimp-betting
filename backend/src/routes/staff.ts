import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BetSide, BetStatus, RoundStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { openRound, settleRound, stopRound, lockRound } from '../services/round.service'
import { unlockAndRefund } from '../services/wallet.service'

async function requireStaffOrAdmin(request: any, reply: any) {
  const { role } = request.user as { role: string }
  if (!['staff', 'admin'].includes(role)) {
    return reply.status(403).send({ error: 'Staff access required' })
  }
}

export async function staffRoutes(app: FastifyInstance) {
  const preHandler = [app.authenticate, requireStaffOrAdmin]

  // ── Round list ─────────────────────────────────────────────

  app.get('/shops/:shopId/rounds', { preHandler }, async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const rounds = await prisma.round.findMany({
      where: { shopId },
      orderBy: { openedAt: 'desc' },
      take: 20,
      include: { _count: { select: { bets: true } } },
    })
    return reply.send(rounds.map(r => ({
      id: r.id, status: r.status,
      totalEven: r.totalEven.toNumber(), totalOdd: r.totalOdd.toNumber(),
      result: r.result, betCount: r._count.bets,
      openedAt: r.openedAt, settledAt: r.settledAt,
    })))
  })

  // ── Open round ─────────────────────────────────────────────

  app.post('/rounds/open', { preHandler }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { shopId } = z.object({ shopId: z.string().min(1) }).parse(request.body)
    try {
      const round = await openRound(shopId, userId)
      return reply.status(201).send({ roundId: round.id, status: round.status, openedAt: round.openedAt })
    } catch (err: any) {
      if (err.message === 'ROUND_ALREADY_OPEN') return reply.status(409).send({ error: 'A round is already open' })
      throw err
    }
  })

  // ── Settle ─────────────────────────────────────────────────

  app.post('/rounds/:id/settle', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { result } = z.object({ result: z.enum(['even', 'odd']) }).parse(request.body)
    const round = await prisma.round.findUniqueOrThrow({ where: { id } })
    if (round.status === RoundStatus.open) await lockRound(id, round.shopId)
    try {
      const settlement = await settleRound(id, result as BetSide, round.shopId)
      return reply.send({ roundId: id, result: settlement.result, payouts: settlement.payouts })
    } catch (err: any) {
      if (err.message === 'ROUND_NOT_LOCKED') return reply.status(400).send({ error: 'Round must be locked first' })
      throw err
    }
  })

  // ── Next round ─────────────────────────────────────────────

  app.post('/rounds/:id/next', { preHandler }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const prev = await prisma.round.findUniqueOrThrow({ where: { id } })
    if (prev.status !== RoundStatus.settled && prev.status !== RoundStatus.cancelled) {
      return reply.status(400).send({ error: 'Previous round must be settled first' })
    }
    const round = await openRound(prev.shopId, userId)
    return reply.status(201).send({ roundId: round.id, status: round.status, openedAt: round.openedAt })
  })

  // ── Stop (cancel + refund all) ─────────────────────────────

  app.post('/rounds/:id/stop', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const round = await prisma.round.findUniqueOrThrow({ where: { id } })
    if (round.status === RoundStatus.settled) return reply.status(400).send({ error: 'Already settled' })
    await stopRound(id, round.shopId)
    return reply.send({ message: 'Round stopped, all bets refunded', roundId: id })
  })

  // ── Void (admin override after settle) ────────────────────

  app.post('/rounds/:id/void', { preHandler: [app.authenticate, async (req: any, rep: any) => {
    if (req.user.role !== 'admin') return rep.status(403).send({ error: 'Admin only' })
  }] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const round = await prisma.round.findUniqueOrThrow({ where: { id } })

    if (round.status !== RoundStatus.settled) {
      return reply.status(400).send({ error: 'Can only void settled rounds' })
    }

    // Check within 5-minute window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    if (round.settledAt && round.settledAt < fiveMinutesAgo) {
      return reply.status(400).send({ error: 'Void window expired (5 minutes)' })
    }

    // Reverse all payouts: deduct from winners, refund losers
    const bets = await prisma.bet.findMany({ where: { roundId: id } })

    await prisma.$transaction(async (tx) => {
      for (const bet of bets) {
        if (bet.status === BetStatus.won && bet.payout) {
          // Deduct payout from winner wallet
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: { balance: { decrement: bet.payout } },
          })
          await tx.transaction.create({
            data: { userId: bet.userId, type: 'withdraw', amount: bet.payout.negated(), note: `Void round ${id}`, refId: id },
          })
        } else if (bet.status === BetStatus.lost) {
          // Refund the lost amount
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: { balance: { increment: bet.amountAccepted } },
          })
          await tx.transaction.create({
            data: { userId: bet.userId, type: 'bet_refund', amount: bet.amountAccepted, note: `Void round ${id}`, refId: id },
          })
        }
        await tx.bet.update({ where: { id: bet.id }, data: { status: BetStatus.refunded, payout: null } })
      }
      await tx.round.update({ where: { id }, data: { status: RoundStatus.cancelled, result: null } })
    })

    return reply.send({ message: 'Round voided and all bets refunded', roundId: id })
  })

  // ── Live bets for current round ────────────────────────────

  app.get('/rounds/:id/bets', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const bets = await prisma.bet.findMany({
      where: { roundId: id },
      include: { user: { select: { displayName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const evenTotal = bets.filter(b => b.side === 'even').reduce((s, b) => s + b.amountAccepted.toNumber(), 0)
    const oddTotal  = bets.filter(b => b.side === 'odd').reduce((s, b) => s + b.amountAccepted.toNumber(), 0)

    return reply.send({
      bets: bets.map(b => ({
        id: b.id, side: b.side,
        amountAccepted: b.amountAccepted.toNumber(),
        payout: b.payout?.toNumber() ?? null,
        status: b.status,
        user: b.user,
        createdAt: b.createdAt,
      })),
      summary: { evenTotal, oddTotal, total: evenTotal + oddTotal, count: bets.length },
    })
  })

  // ── Today's summary ────────────────────────────────────────

  app.get('/shops/:shopId/summary', { preHandler }, async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const rounds = await prisma.round.findMany({
      where: { shopId, openedAt: { gte: today } },
      include: { bets: { select: { amountAccepted: true, status: true } } },
    })
    const totalRounds   = rounds.length
    const settledRounds = rounds.filter(r => r.status === RoundStatus.settled).length
    // Gross volume = all bets placed today (won + lost + refunded — everything)
    const grossVolume = rounds.reduce((s, r) => {
      return s + r.bets.reduce((bs: number, b: any) => bs + Number(b.amountAccepted), 0)
    }, 0)
    // Net volume = only matched bets (won + lost), for shop fee calc
    const netVolume = rounds.reduce((s, r) => {
      const matched = r.bets.filter((b: any) => b.status === 'won' || b.status === 'lost')
      return s + matched.reduce((bs: number, b: any) => bs + Number(b.amountAccepted), 0)
    }, 0)
    return reply.send({
      totalRounds, settledRounds,
      totalVolume: grossVolume, netVolume, shopFee: netVolume * 0.10,
      rounds: rounds.map(r => ({
        id: r.id, status: r.status, result: r.result,
        totalEven: r.totalEven.toNumber(), totalOdd: r.totalOdd.toNumber(), openedAt: r.openedAt,
      })),
    })
  })

  // ── Pending PromptPay deposits for this shop ───────────────

  app.get('/shops/:shopId/pending-deposits', { preHandler }, async (request, reply) => {
    const { shopId } = request.params as { shopId: string }

    // Find staff's shop's customers — show recent pending PromptPay requests
    const pending = await prisma.transaction.findMany({
      where: { note: { startsWith: 'PromptPay pending' }, amount: 0 },
      include: { user: { select: { id: true, displayName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    return reply.send(pending.map(t => ({
      id: t.id,
      user: t.user,
      amount: parseFloat(t.note?.replace('PromptPay pending ', '') || '0'),
      createdAt: t.createdAt,
    })))
  })

  // ── Member credit adjustment (staff can use) ───────────────

  app.post('/members/:userId/adjust', { preHandler }, async (request, reply) => {
    const { userId: staffId } = request.user as { userId: string }
    const { userId } = request.params as { userId: string }
    const { amount, note } = z.object({
      amount: z.number(),
      note:   z.string().min(1),
    }).parse(request.body)

    await prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } })
      if (amount < 0 && wallet.balance.toNumber() + amount < 0) {
        throw new Error('INSUFFICIENT_BALANCE')
      }
      await tx.wallet.update({
        where: { userId },
        data:  { balance: { increment: amount } },
      })
      await tx.transaction.create({
        data: {
          userId,
          type:  amount > 0 ? 'deposit' : 'withdraw',
          amount,
          note: `Staff adjust by ${staffId}: ${note}`,
          refId: staffId,
        },
      })
    })

    return reply.send({ message: 'Balance adjusted', amount })
  })

  // ── Member list (staff can search) ────────────────────────

  app.get('/members', { preHandler }, async (request, reply) => {
    const { q = '', page = 1 } = z.object({
      q:    z.string().optional().default(''),
      page: z.coerce.number().default(1),
    }).parse(request.query)

    const limit = 20
    const where: any = q ? {
      OR: [
        { phone:       { contains: q } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    } : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { wallet: { select: { balance: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({
      data: users.map((u: any) => ({
        id:          u.id,
        phone:       u.phone,
        displayName: u.displayName,
        balance:     u.wallet?.balance.toNumber() ?? 0,
        isActive:    u.isActive,
      })),
      total, page,
      totalPages: Math.ceil(total / limit),
    })
  })
}
