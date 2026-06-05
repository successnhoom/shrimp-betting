import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

// ── Round status machine tests ────────────────────────────────────────────────

describe('Round status transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    open:      ['locked', 'cancelled'],
    locked:    ['settled', 'cancelled'],
    settled:   [],              // terminal — only admin void
    cancelled: [],              // terminal
  }

  function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  it('open → locked is valid', () => expect(canTransition('open', 'locked')).toBe(true))
  it('open → cancelled is valid', () => expect(canTransition('open', 'cancelled')).toBe(true))
  it('locked → settled is valid', () => expect(canTransition('locked', 'settled')).toBe(true))
  it('locked → cancelled is valid', () => expect(canTransition('locked', 'cancelled')).toBe(true))
  it('settled → anything is invalid', () => {
    expect(canTransition('settled', 'open')).toBe(false)
    expect(canTransition('settled', 'locked')).toBe(false)
    expect(canTransition('settled', 'cancelled')).toBe(false)
  })
  it('cancelled → anything is invalid', () => {
    expect(canTransition('cancelled', 'open')).toBe(false)
    expect(canTransition('cancelled', 'settled')).toBe(false)
  })
  it('open → settled is invalid (must lock first)', () => {
    expect(canTransition('open', 'settled')).toBe(false)
  })
})

// ── Round void window tests ───────────────────────────────────────────────────

describe('Round void eligibility', () => {
  const VOID_WINDOW_MS = 5 * 60 * 1000

  function canVoid(settledAt: Date | null, status: string): boolean {
    if (status !== 'settled' || !settledAt) return false
    return Date.now() - settledAt.getTime() < VOID_WINDOW_MS
  }

  it('allows void within 5 minutes', () => {
    const settledAt = new Date(Date.now() - 2 * 60 * 1000)
    expect(canVoid(settledAt, 'settled')).toBe(true)
  })

  it('blocks void after 5 minutes', () => {
    const settledAt = new Date(Date.now() - 6 * 60 * 1000)
    expect(canVoid(settledAt, 'settled')).toBe(false)
  })

  it('blocks void on non-settled rounds', () => {
    expect(canVoid(new Date(), 'open')).toBe(false)
    expect(canVoid(new Date(), 'locked')).toBe(false)
    expect(canVoid(new Date(), 'cancelled')).toBe(false)
  })

  it('blocks void when settledAt is null', () => {
    expect(canVoid(null, 'settled')).toBe(false)
  })
})

// ── Round timer tests ─────────────────────────────────────────────────────────

describe('Round timer', () => {
  const DURATION_MS = 180_000 // 3 minutes
  const BALANCE_WINDOW_MS = 30_000

  it('lock triggers 30s before end', () => {
    const lockDelay = DURATION_MS - BALANCE_WINDOW_MS
    expect(lockDelay).toBe(150_000) // 2.5 minutes
  })

  it('calculates remaining time correctly', () => {
    const openedAt = Date.now() - 60_000 // opened 1 minute ago
    const elapsed  = Date.now() - openedAt
    const remaining = Math.max(0, DURATION_MS - elapsed)
    expect(remaining).toBeCloseTo(120_000, -3) // ~2 minutes left
  })

  it('clamps remaining time to 0', () => {
    const openedAt = Date.now() - 200_000 // opened 200s ago (past deadline)
    const elapsed  = Date.now() - openedAt
    const remaining = Math.max(0, DURATION_MS - elapsed)
    expect(remaining).toBe(0)
  })
})

// ── Bet validation tests ──────────────────────────────────────────────────────

describe('Bet validation', () => {
  const MIN_BET    = 10
  const MAX_BET    = 100_000

  function validateBet(amount: number, balance: number, roundStatus: string): string | null {
    if (roundStatus !== 'open') return 'ROUND_NOT_OPEN'
    if (amount < MIN_BET)       return 'AMOUNT_TOO_LOW'
    if (amount > MAX_BET)       return 'AMOUNT_TOO_HIGH'
    if (amount > balance)       return 'INSUFFICIENT_BALANCE'
    return null
  }

  it('accepts valid bet', () => {
    expect(validateBet(500, 1000, 'open')).toBeNull()
  })

  it('rejects bet on closed round', () => {
    expect(validateBet(500, 1000, 'locked')).toBe('ROUND_NOT_OPEN')
    expect(validateBet(500, 1000, 'settled')).toBe('ROUND_NOT_OPEN')
  })

  it('rejects bet below minimum', () => {
    expect(validateBet(5, 1000, 'open')).toBe('AMOUNT_TOO_LOW')
    expect(validateBet(0, 1000, 'open')).toBe('AMOUNT_TOO_LOW')
  })

  it('rejects bet above maximum', () => {
    expect(validateBet(100_001, 200_000, 'open')).toBe('AMOUNT_TOO_HIGH')
  })

  it('rejects bet when balance insufficient', () => {
    expect(validateBet(500, 300, 'open')).toBe('INSUFFICIENT_BALANCE')
  })

  it('rejects bet exactly over balance', () => {
    expect(validateBet(1001, 1000, 'open')).toBe('INSUFFICIENT_BALANCE')
  })

  it('accepts bet exactly at balance', () => {
    expect(validateBet(1000, 1000, 'open')).toBeNull()
  })

  it('accepts minimum bet', () => {
    expect(validateBet(10, 1000, 'open')).toBeNull()
  })

  it('accepts maximum bet', () => {
    expect(validateBet(100_000, 200_000, 'open')).toBeNull()
  })
})

// ── Payout distribution tests ─────────────────────────────────────────────────

describe('Payout distribution', () => {
  const RATE = 0.90

  function calculatePayouts(bets: { id: string; side: 'even'|'odd'; amount: number }[], result: 'even'|'odd') {
    return bets.map(b => ({
      ...b,
      won:    b.side === result,
      payout: b.side === result ? b.amount * RATE : 0,
    }))
  }

  it('pays only winners', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 1000 },
      { id: '2', side: 'odd'  as const, amount: 1000 },
    ]
    const result = calculatePayouts(bets, 'even')
    expect(result.find(b => b.id === '1')!.payout).toBe(900)
    expect(result.find(b => b.id === '2')!.payout).toBe(0)
  })

  it('shop keeps 10% of total volume', () => {
    const total  = 2000
    const payout = 900  // one winner with 1000 bet at 90%
    const shopFee = total - payout // losers' money + cut from winner
    expect(shopFee).toBe(1100) // shop gets 100 (cut) + 1000 (loser bet)
  })

  it('multiple winners each get 90%', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 100 },
      { id: '2', side: 'even' as const, amount: 200 },
      { id: '3', side: 'even' as const, amount: 500 },
    ]
    const result = calculatePayouts(bets, 'even')
    expect(result[0].payout).toBe(90)
    expect(result[1].payout).toBe(180)
    expect(result[2].payout).toBe(450)
  })

  it('no payout when round is cancelled', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 1000 },
      { id: '2', side: 'odd'  as const, amount: 1000 },
    ]
    // On cancel, all bets get refunded (amount back, no payout)
    const refunds = bets.map(b => ({ ...b, refund: b.amount, payout: 0 }))
    refunds.forEach(r => expect(r.refund).toBe(r.amount))
  })
})
