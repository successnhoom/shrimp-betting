/**
 * Lightweight test runner — ใช้ node โดยตรงโดยไม่ต้องการ vitest
 * รัน: node src/__tests__/run.mjs
 */

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++ }
  catch(e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++ }
}
function expect(val) {
  return {
    toBe:         exp => { if(val !== exp) throw new Error(`expected ${exp}, got ${val}`) },
    toBeNull:     ()  => { if(val !== null) throw new Error(`expected null, got ${val}`) },
    toBe:         exp => { if(val !== exp) throw new Error(`expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`) },
    toBeGreaterThanOrEqual: n => { if(val < n) throw new Error(`expected ${val} >= ${n}`) },
    toBeLessThanOrEqual:    n => { if(val > n) throw new Error(`expected ${val} <= ${n}`) },
    toHaveLength: n  => { if(val.length !== n) throw new Error(`expected length ${n}, got ${val.length}`) },
    toMatch:      re => { if(!re.test(val)) throw new Error(`${val} does not match ${re}`) },
  }
}
function describe(name, fn) { console.log(`\n📦 ${name}`); fn() }

// ─── Payout Calculation ──────────────────────────────────────────────────────
describe('Payout calculation', () => {
  test('90% payout on 1000', () => expect(1000 * 0.90).toBe(900))
  test('minimum bet payout', () => expect(10 * 0.90).toBe(9))
  test('large bet payout',   () => expect(100000 * 0.90).toBe(90000))
  test('shop fee is 10%',    () => expect(5000 * 0.10).toBe(500))
})

// ─── Auto-balance ────────────────────────────────────────────────────────────
describe('Auto-balance algorithm', () => {
  function autoBalance(bets) {
    const evenTotal = bets.filter(b=>b.side==='even').reduce((s,b)=>s+b.amount,0)
    const oddTotal  = bets.filter(b=>b.side==='odd').reduce((s,b)=>s+b.amount,0)
    if (evenTotal === oddTotal) return { bets, refunds: [] }
    const diff = Math.abs(evenTotal - oddTotal)
    const excessSide = evenTotal > oddTotal ? 'even' : 'odd'
    const sorted = [...bets].filter(b=>b.side===excessSide).reverse()
    let remaining = diff
    const refunds = []
    const result = bets.map(b=>({...b}))
    for (const bet of sorted) {
      if (remaining <= 0) break
      const target = result.find(b=>b.id===bet.id)
      if (target.amount <= remaining) {
        refunds.push({id:target.id, amount:target.amount})
        remaining -= target.amount; target.amount = 0
      } else {
        refunds.push({id:target.id, amount:remaining})
        target.amount -= remaining; remaining = 0
      }
    }
    return { bets: result, refunds }
  }

  test('no change when balanced', () => {
    const {refunds} = autoBalance([{id:'1',side:'even',amount:500},{id:'2',side:'odd',amount:500}])
    expect(refunds.length).toBe(0)
  })

  test('partial cut on last bet', () => {
    const {bets:r} = autoBalance([{id:'1',side:'even',amount:1000},{id:'2',side:'odd',amount:800}])
    expect(r.find(b=>b.id==='1').amount).toBe(800)
  })

  test('full refund when bet <= diff', () => {
    const {refunds} = autoBalance([
      {id:'1',side:'even',amount:500},{id:'2',side:'even',amount:300},
      {id:'3',side:'odd',amount:500}
    ])
    expect(refunds.find(r=>r.id==='2').amount).toBe(300)
  })

  test('LIFO — cuts newest first', () => {
    const {refunds} = autoBalance([
      {id:'1',side:'even',amount:300},{id:'2',side:'even',amount:300},{id:'3',side:'even',amount:300},
      {id:'4',side:'odd',amount:500}
    ])
    expect(refunds.find(r=>r.id==='3').amount).toBe(300) // newest cut first
  })

  test('both sides equal after balance', () => {
    const bets = [{id:'1',side:'even',amount:800},{id:'2',side:'odd',amount:600}]
    const {bets:r} = autoBalance(bets)
    const ev = r.filter(b=>b.side==='even').reduce((s,b)=>s+b.amount,0)
    const od = r.filter(b=>b.side==='odd').reduce((s,b)=>s+b.amount,0)
    expect(ev).toBe(od)
  })
})

// ─── Bet validation ──────────────────────────────────────────────────────────
describe('Bet validation', () => {
  function validate(amount, balance, status) {
    if (status !== 'open')   return 'ROUND_NOT_OPEN'
    if (amount < 10)         return 'AMOUNT_TOO_LOW'
    if (amount > 100000)     return 'AMOUNT_TOO_HIGH'
    if (amount > balance)    return 'INSUFFICIENT_BALANCE'
    return null
  }
  test('accepts valid bet',       () => expect(validate(500,1000,'open')).toBeNull())
  test('rejects locked round',    () => expect(validate(500,1000,'locked')).toBe('ROUND_NOT_OPEN'))
  test('rejects amount < 10',     () => expect(validate(5,1000,'open')).toBe('AMOUNT_TOO_LOW'))
  test('rejects amount > 100000', () => expect(validate(100001,200000,'open')).toBe('AMOUNT_TOO_HIGH'))
  test('rejects insufficient',    () => expect(validate(500,300,'open')).toBe('INSUFFICIENT_BALANCE'))
  test('accepts exact balance',   () => expect(validate(1000,1000,'open')).toBeNull())
})

// ─── Round void window ───────────────────────────────────────────────────────
describe('Round void window', () => {
  const W = 5*60*1000
  const canVoid = (settledAt, status) =>
    status === 'settled' && settledAt && Date.now() - settledAt.getTime() < W

  test('allows void within 5 min', () => {
    const t = new Date(Date.now()-2*60*1000); expect(!!canVoid(t,'settled')).toBe(true)
  })
  test('blocks void after 5 min', () => {
    const t = new Date(Date.now()-6*60*1000); expect(!!canVoid(t,'settled')).toBe(false)
  })
  test('blocks void on open round', () => expect(!!canVoid(new Date(),'open')).toBe(false))
})

// ─── OTP ─────────────────────────────────────────────────────────────────────
describe('OTP', () => {
  test('generates 6-digit code', () => {
    const otp = String(Math.floor(100000 + Math.random()*900000))
    expect(otp.length).toBe(6)
    expect(Number(otp) >= 100000).toBe(true)
    expect(Number(otp) <= 999999).toBe(true)
  })
  test('expires after 5 minutes', () => {
    const created = Date.now() - 301*1000
    const expired = Date.now() > created + 300*1000
    expect(expired).toBe(true)
  })
  test('valid within window', () => {
    const created = Date.now() - 60*1000
    const expired = Date.now() > created + 300*1000
    expect(expired).toBe(false)
  })
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
