import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeWallet(balance: number, locked = 0) {
  return { balance: new Decimal(balance), lockedAmount: new Decimal(locked) }
}

// ── Pure payout calculation tests (no DB) ────────────────────────────────────

describe('Payout calculation', () => {
  const PAYOUT_RATE = 0.90

  it('calculates 90% payout correctly', () => {
    const amount  = 1000
    const payout  = amount * PAYOUT_RATE
    expect(payout).toBe(900)
  })

  it('calculates minimum bet payout', () => {
    expect(10 * PAYOUT_RATE).toBe(9)
  })

  it('calculates large bet payout', () => {
    expect(100000 * PAYOUT_RATE).toBe(90000)
  })

  it('shop fee is always 10%', () => {
    const volume = 5000
    const fee    = volume * 0.10
    expect(fee).toBe(500)
  })
})

// ── Auto-balance algorithm tests ─────────────────────────────────────────────

describe('Auto-balance algorithm', () => {
  function autoBalance(bets: { id: string; side: 'even'|'odd'; amount: number }[]) {
    const evenTotal = bets.filter(b => b.side === 'even').reduce((s, b) => s + b.amount, 0)
    const oddTotal  = bets.filter(b => b.side === 'odd').reduce((s, b) => s + b.amount, 0)

    if (evenTotal === oddTotal) return { bets, refunds: [] }

    const diff       = Math.abs(evenTotal - oddTotal)
    const excessSide = evenTotal > oddTotal ? 'even' : 'odd'
    const sorted     = [...bets].filter(b => b.side === excessSide).reverse() // LIFO

    let remaining = diff
    const refunds: { id: string; amount: number }[] = []
    const result  = bets.map(b => ({ ...b }))

    for (const bet of sorted) {
      if (remaining <= 0) break
      const target = result.find(b => b.id === bet.id)!

      if (target.amount <= remaining) {
        refunds.push({ id: target.id, amount: target.amount })
        remaining -= target.amount
        target.amount = 0
      } else {
        refunds.push({ id: target.id, amount: remaining })
        target.amount -= remaining
        remaining = 0
      }
    }

    return { bets: result, refunds }
  }

  it('does nothing when already balanced', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 500 },
      { id: '2', side: 'odd'  as const, amount: 500 },
    ]
    const { refunds } = autoBalance(bets)
    expect(refunds).toHaveLength(0)
  })

  it('cuts last even bet when even side is larger', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 500 },
      { id: '2', side: 'even' as const, amount: 500 }, // ← cut this
      { id: '3', side: 'odd'  as const, amount: 800 },
    ]
    const { bets: result, refunds } = autoBalance(bets)
    const evenTotal = result.filter(b => b.side === 'even').reduce((s, b) => s + b.amount, 0)
    const oddTotal  = result.filter(b => b.side === 'odd').reduce((s, b) => s + b.amount, 0)

    expect(evenTotal).toBe(oddTotal)
    expect(refunds.length).toBeGreaterThan(0)
  })

  it('partial cut on last bet when diff < last bet amount', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 1000 },
      { id: '2', side: 'odd'  as const, amount: 800 },
    ]
    const { bets: result, refunds } = autoBalance(bets)
    const evenFinal = result.find(b => b.id === '1')!.amount

    expect(evenFinal).toBe(800)
    expect(refunds[0].amount).toBe(200)
  })

  it('cuts multiple bets LIFO order when needed', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 300 }, // oldest
      { id: '2', side: 'even' as const, amount: 300 },
      { id: '3', side: 'even' as const, amount: 300 }, // newest — cut first
      { id: '4', side: 'odd'  as const, amount: 500 },
    ]
    const { bets: result, refunds } = autoBalance(bets)
    const evenTotal = result.filter(b => b.side === 'even').reduce((s, b) => s + b.amount, 0)
    const oddTotal  = result.filter(b => b.side === 'odd').reduce((s, b) => s + b.amount, 0)

    expect(evenTotal).toBe(oddTotal)
    // Should cut bet id='3' first (LIFO), then partial of id='2'
    expect(refunds.find(r => r.id === '3')?.amount).toBe(300)
    expect(refunds.find(r => r.id === '2')?.amount).toBe(400)
  })

  it('handles zero bets gracefully', () => {
    const { refunds } = autoBalance([])
    expect(refunds).toHaveLength(0)
  })

  it('handles all same side', () => {
    const bets = [
      { id: '1', side: 'even' as const, amount: 500 },
      { id: '2', side: 'even' as const, amount: 300 },
    ]
    const { bets: result, refunds } = autoBalance(bets)
    // All even, no odd → cut everything from even side
    const evenTotal = result.filter(b => b.side === 'even').reduce((s, b) => s + b.amount, 0)
    const oddTotal  = result.filter(b => b.side === 'odd').reduce((s, b) => s + b.amount, 0)
    expect(evenTotal).toBe(oddTotal) // both 0
  })
})

// ── Wallet lock/unlock balance tests ─────────────────────────────────────────

describe('Wallet balance invariants', () => {
  it('locking funds reduces balance and increases locked', () => {
    const wallet    = makeWallet(1000, 0)
    const lockAmt   = 300
    const newBal    = wallet.balance.toNumber()    - lockAmt
    const newLocked = wallet.lockedAmount.toNumber() + lockAmt

    expect(newBal).toBe(700)
    expect(newLocked).toBe(300)
    expect(newBal + newLocked).toBe(1000) // invariant: total unchanged
  })

  it('payout increases balance and decreases locked', () => {
    const wallet   = makeWallet(700, 300) // 300 locked from bet
    const locked   = 300
    const payout   = locked * 0.9
    const newBal   = wallet.balance.toNumber() + payout
    const newLocked= wallet.lockedAmount.toNumber() - locked

    expect(newBal).toBe(970)
    expect(newLocked).toBe(0)
  })

  it('losing removes locked without restoring balance', () => {
    const wallet   = makeWallet(700, 300)
    const newBal   = wallet.balance.toNumber() // unchanged
    const newLocked= wallet.lockedAmount.toNumber() - 300 // freed

    expect(newBal).toBe(700)
    expect(newLocked).toBe(0)
    // total reduced by bet amount — money is gone
    expect(newBal + newLocked).toBe(700)
  })

  it('refund restores balance fully', () => {
    const wallet   = makeWallet(700, 300)
    const refund   = 300
    const newBal   = wallet.balance.toNumber() + refund
    const newLocked= wallet.lockedAmount.toNumber() - refund

    expect(newBal).toBe(1000)
    expect(newLocked).toBe(0)
  })

  it('cannot lock more than available balance', () => {
    const wallet  = makeWallet(100)
    const lockAmt = 200
    const canLock = wallet.balance.toNumber() >= lockAmt

    expect(canLock).toBe(false)
  })
})

// ── OTP expiry tests ──────────────────────────────────────────────────────────

describe('OTP expiry', () => {
  const OTP_EXPIRY_SECONDS = 5 * 60

  it('OTP is valid within expiry window', () => {
    const createdAt  = Date.now()
    const checkAt    = createdAt + (OTP_EXPIRY_SECONDS - 1) * 1000
    const isExpired  = checkAt > createdAt + OTP_EXPIRY_SECONDS * 1000
    expect(isExpired).toBe(false)
  })

  it('OTP is expired after expiry window', () => {
    const createdAt = Date.now() - (OTP_EXPIRY_SECONDS + 1) * 1000
    const isExpired = Date.now() > createdAt + OTP_EXPIRY_SECONDS * 1000
    expect(isExpired).toBe(true)
  })

  it('generates 6-digit OTP', () => {
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    expect(otp).toHaveLength(6)
    expect(Number(otp)).toBeGreaterThanOrEqual(100000)
    expect(Number(otp)).toBeLessThanOrEqual(999999)
  })
})

// ── PromptPay QR tests ────────────────────────────────────────────────────────

describe('PromptPay phone formatting', () => {
  function formatPhone(phone: string): string {
    return `0066${phone.replace(/^0/, '')}`
  }

  it('formats 08xxxxxxxx correctly', () => {
    expect(formatPhone('0812345678')).toBe('006681234567 8')
      .toString().replace(/\s/g, '')
    expect(formatPhone('0812345678')).toBe('00668123456 78'.replace(/\s/g,''))
  })

  it('normalizes leading zero', () => {
    const result = formatPhone('0987654321')
    expect(result.startsWith('0066')).toBe(true)
    expect(result).not.toContain('00660')
  })

  it('formats correctly for all Thai networks', () => {
    const phones = ['0611111111','0711111111','0811111111','0911111111']
    phones.forEach(p => {
      const formatted = formatPhone(p)
      expect(formatted).toMatch(/^0066[6-9]\d{8}$/)
    })
  })
})
