import { Decimal } from '@prisma/client/runtime/library'
import { BetSide, BetStatus, RoundStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { lockFunds, unlockAndRefund, settlePayout, settleLoser } from './wallet.service'
import { emitRoundOpened, emitRoundLocked, emitRoundSettled, emitRoundStopped, emitOddsUpdate as emitOdds } from '../lib/socket'
import { scheduleRoundLock, cancelScheduledLock } from '../jobs/round.jobs'
import { notifyWinner } from '../jobs/notification.jobs'
import { notifyWin, notifyLose, notifyRefund } from './notification.service'

const PAYOUT_RATE = parseFloat(process.env.PAYOUT_RATE || '0.90')
const ROUND_DURATION = parseInt(process.env.ROUND_DURATION_SECONDS || '180') * 1000
const BALANCE_WINDOW = parseInt(process.env.BALANCE_CUT_WINDOW_SECONDS || '30') * 1000

export async function openRound(shopId: string, staffId: string) {
  // Check no open round exists
  const existing = await prisma.round.findFirst({
    where: { shopId, status: { in: [RoundStatus.open, RoundStatus.locked] } },
  })
  if (existing) throw new Error('ROUND_ALREADY_OPEN')

  const round = await prisma.round.create({
    data: { shopId, staffId, status: RoundStatus.open },
  })

  const expiresAt = new Date(Date.now() + ROUND_DURATION).toISOString()
  emitRoundOpened(shopId, { roundId: round.id, shopId, expiresAt })

  // Schedule auto-lock via BullMQ (persists across restarts)
  await scheduleRoundLock(round.id, shopId, ROUND_DURATION - BALANCE_WINDOW)

  return round
}

export async function lockRound(roundId: string, shopId: string) {
  const round = await prisma.round.findUniqueOrThrow({ where: { id: roundId } })
  if (round.status !== RoundStatus.open) return

  // Run auto-balance
  await autoBalance(roundId)

  await prisma.round.update({
    where: { id: roundId },
    data: { status: RoundStatus.locked, closedAt: new Date() },
  })

  emitRoundLocked(shopId, roundId)
  await cancelScheduledLock(roundId)
}

export async function autoBalance(roundId: string) {
  const bets = await prisma.bet.findMany({
    where: { roundId, status: { in: [BetStatus.accepted, BetStatus.partial] } },
    orderBy: { createdAt: 'desc' },
  })

  const totalEven = bets.filter(b => b.side === BetSide.even).reduce((s, b) => s.add(b.amountAccepted), new Decimal(0))
  const totalOdd = bets.filter(b => b.side === BetSide.odd).reduce((s, b) => s.add(b.amountAccepted), new Decimal(0))

  const diff = totalEven.sub(totalOdd).abs()
  if (diff.lte(0)) return // Already balanced

  const excessSide = totalEven.gt(totalOdd) ? BetSide.even : BetSide.odd
  const excessBets = bets.filter(b => b.side === excessSide)

  let remaining = diff
  for (const bet of excessBets) {
    if (remaining.lte(0)) break

    if (bet.amountAccepted.lte(remaining)) {
      // Refund entire bet
      await prisma.$transaction(async (tx) => {
        await tx.bet.update({
          where: { id: bet.id },
          data: { amountAccepted: 0, status: BetStatus.refunded },
        })
        await unlockAndRefund(bet.userId, bet.amountAccepted, bet.id, tx)
      })
      remaining = remaining.sub(bet.amountAccepted)
    } else {
      // Partial refund
      const refundAmt = remaining
      const newAccepted = bet.amountAccepted.sub(refundAmt)
      await prisma.$transaction(async (tx) => {
        await tx.bet.update({
          where: { id: bet.id },
          data: { amountAccepted: newAccepted, status: BetStatus.partial },
        })
        await unlockAndRefund(bet.userId, refundAmt, bet.id, tx)
      })
      remaining = new Decimal(0)
    }
  }
}

export async function placeBet(
  roundId: string,
  userId: string,
  side: BetSide,
  amount: number
) {
  const round = await prisma.round.findUniqueOrThrow({ where: { id: roundId } })
  if (round.status !== RoundStatus.open) throw new Error('ROUND_NOT_OPEN')

  const amountDecimal = new Decimal(amount)

  // Create bet and lock funds atomically
  const bet = await prisma.$transaction(async (tx) => {
    const newBet = await tx.bet.create({
      data: {
        roundId,
        userId,
        side,
        amountRequested: amountDecimal,
        amountAccepted: amountDecimal,
        status: BetStatus.accepted,
      },
    })

    await lockFunds(userId, amountDecimal, newBet.id, tx)

    // Update round totals
    if (side === BetSide.even) {
      await tx.round.update({ where: { id: roundId }, data: { totalEven: { increment: amountDecimal } } })
    } else {
      await tx.round.update({ where: { id: roundId }, data: { totalOdd: { increment: amountDecimal } } })
    }

    return newBet
  })

  // Broadcast new odds
  const updatedRound = await prisma.round.findUniqueOrThrow({ where: { id: roundId } })
  emitOdds(round.shopId, {
    roundId,
    even: updatedRound.totalEven.toNumber(),
    odd: updatedRound.totalOdd.toNumber(),
  })

  return bet
}

export async function settleRound(roundId: string, result: BetSide, shopId: string) {
  const round = await prisma.round.findUniqueOrThrow({ where: { id: roundId } })
  if (round.status !== RoundStatus.locked) throw new Error('ROUND_NOT_LOCKED')

  const bets = await prisma.bet.findMany({
    where: { roundId, status: { in: [BetStatus.accepted, BetStatus.partial] } },
  })

  const payouts: { userId: string; amount: number }[] = []

  await prisma.$transaction(async (tx) => {
    for (const bet of bets) {
      if (bet.side === result) {
        // Winner
        const payout = bet.amountAccepted.mul(PAYOUT_RATE)
        await tx.bet.update({
          where: { id: bet.id },
          data: { payout, status: BetStatus.won },
        })
        await settlePayout(bet.userId, bet.amountAccepted, payout, bet.id, tx)
        payouts.push({ userId: bet.userId, amount: payout.toNumber() })
      } else {
        // Loser
        await tx.bet.update({
          where: { id: bet.id },
          data: { payout: 0, status: BetStatus.lost },
        })
        await settleLoser(bet.userId, bet.amountAccepted, bet.id, tx)
      }
    }

    await tx.round.update({
      where: { id: roundId },
      data: { status: RoundStatus.settled, result, settledAt: new Date() },
    })
  })

  emitRoundSettled(shopId, { roundId, result, payouts })

  // Send SMS + in-app notifications async (use result to determine win/loss)
  for (const bet of bets) {
    if (bet.side === result) {
      // Winner — payout = amountAccepted * PAYOUT_RATE
      const amount = parseFloat((bet.amountAccepted.toNumber() * PAYOUT_RATE).toFixed(2))
      notifyWin(bet.userId, amount, roundId).catch(console.error)
      prisma.user.findUnique({ where: { id: bet.userId }, select: { phone: true } }).then(u => {
        if (u) notifyWinner(u.phone, amount, roundId).catch(console.error)
      })
    } else {
      notifyLose(bet.userId, bet.amountAccepted.toNumber(), roundId).catch(console.error)
    }
  }

  return { result, payouts }
}

export async function stopRound(roundId: string, shopId: string) {
  // Refund all accepted bets
  const bets = await prisma.bet.findMany({
    where: { roundId, status: { in: [BetStatus.accepted, BetStatus.partial] } },
  })

  await prisma.$transaction(async (tx) => {
    for (const bet of bets) {
      await tx.bet.update({ where: { id: bet.id }, data: { status: BetStatus.refunded } })
      await unlockAndRefund(bet.userId, bet.amountAccepted, bet.id, tx)
    }
    await tx.round.update({
      where: { id: roundId },
      data: { status: RoundStatus.cancelled },
    })
  })


  emitRoundStopped(shopId, roundId)
  await cancelScheduledLock(roundId)
}

export async function getCurrentRound(shopId: string) {
  return prisma.round.findFirst({
    where: { shopId, status: { in: [RoundStatus.open, RoundStatus.locked] } },
    orderBy: { openedAt: 'desc' },
  })
}
