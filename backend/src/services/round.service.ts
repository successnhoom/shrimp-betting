import { Decimal } from '@prisma/client/runtime/library'
import { BetSide, BetStatus, RoundStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { lockFunds, unlockAndRefund, settlePayout, settleLoser } from './wallet.service'
import { emitRoundOpened, emitRoundLocked, emitRoundSettled, emitRoundStopped, emitOddsUpdate as emitOdds } from '../lib/socket'
import { scheduleRoundLock, cancelScheduledLock } from '../jobs/round.jobs'
import { notifyWinner } from '../jobs/notification.jobs'
import { notifyWin, notifyLose, notifyRefund } from './notification.service'

const PAYOUT_RATE = parseFloat(process.env.PAYOUT_RATE || '0.90')
const BALANCE_WINDOW = parseInt(process.env.BALANCE_CUT_WINDOW_SECONDS || '30') * 1000

/**
 * เปิดรอบใหม่
 * - autoLockSeconds ไม่ระบุ / null / 0  → โหมดกดเอง: ไม่มีการล็อกอัตโนมัติ staff ปิดรับแทงเองเมื่อพร้อม
 * - autoLockSeconds เป็นจำนวนวินาที      → โหมดตั้งเวลา: ระบบจะล็อกให้เองอัตโนมัติตามเวลาที่ตั้ง (ลบ BALANCE_WINDOW ไว้ตัดยอดบาลานซ์ก่อนล็อกจริง)
 */
export async function openRound(shopId: string, staffId: string, autoLockSeconds?: number | null) {
  // Check no open round exists
  const existing = await prisma.round.findFirst({
    where: { shopId, status: { in: [RoundStatus.open, RoundStatus.locked] } },
  })
  if (existing) throw new Error('ROUND_ALREADY_OPEN')

  const round = await prisma.round.create({
    data: { shopId, staffId, status: RoundStatus.open },
  })

  const useAutoLock = typeof autoLockSeconds === 'number' && autoLockSeconds > 0
  const expiresAt = useAutoLock ? new Date(Date.now() + autoLockSeconds! * 1000).toISOString() : null
  emitRoundOpened(shopId, { roundId: round.id, shopId, expiresAt })

  if (useAutoLock) {
    const lockDelayMs = Math.max(autoLockSeconds! * 1000 - BALANCE_WINDOW, 1000)
    await scheduleRoundLock(round.id, shopId, lockDelayMs)
  }

  return round
}

export async function lockRound(roundId: string, shopId: string) {
  const round = await prisma.round.findUniqueOrThrow({ where: { id: roundId } })
  if (round.status !== RoundStatus.open) {
    // BUG-06 fix: always cancel the scheduled job even if round is already locked
    await cancelScheduledLock(roundId)
    return
  }

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
  const totalOdd  = bets.filter(b => b.side === BetSide.odd).reduce((s, b) => s.add(b.amountAccepted), new Decimal(0))

  const diff = totalEven.sub(totalOdd).abs()
  if (diff.lte(0)) return // Already balanced

  const excessSide = totalEven.gt(totalOdd) ? BetSide.even : BetSide.odd
  const excessBets = bets.filter(b => b.side === excessSide)

  // BUG-05 fix: pre-compute all refunds, then execute in ONE transaction
  type RefundItem = {
    bet: (typeof bets)[0]
    refundAmt: Decimal
    newAccepted: Decimal
    fullRefund: boolean
  }
  const toRefund: RefundItem[] = []
  let remaining = diff

  for (const bet of excessBets) {
    if (remaining.lte(0)) break
    if (bet.amountAccepted.lte(remaining)) {
      toRefund.push({ bet, refundAmt: bet.amountAccepted, newAccepted: new Decimal(0), fullRefund: true })
      remaining = remaining.sub(bet.amountAccepted)
    } else {
      const refundAmt = remaining
      toRefund.push({ bet, refundAmt, newAccepted: bet.amountAccepted.sub(refundAmt), fullRefund: false })
      remaining = new Decimal(0)
    }
  }

  if (toRefund.length === 0) return

  await prisma.$transaction(async (tx) => {
    for (const item of toRefund) {
      await tx.bet.update({
        where: { id: item.bet.id },
        data: {
          amountAccepted: item.newAccepted,
          status: item.fullRefund ? BetStatus.refunded : BetStatus.partial,
        },
      })
      await unlockAndRefund(item.bet.userId, item.refundAmt, item.bet.id, tx)
    }
  })
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
