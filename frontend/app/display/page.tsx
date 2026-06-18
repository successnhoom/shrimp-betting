'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { betApi, staffApi, leaderboardApi } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import { Logo, LogoBg } from '@/components/Logo'

const SHOP_ID = 'shop-demo-001'

function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    if (value === prev.current) return
    const diff = value - prev.current, steps = 20
    let step = 0
    const t = setInterval(() => {
      step++
      setDisplay(Math.round(prev.current + (diff * step) / steps))
      if (step >= steps) { setDisplay(value); prev.current = value; clearInterval(t) }
    }, 20)
    return () => clearInterval(t)
  }, [value])
  return <>{display.toLocaleString()}</>
}

export default function DisplayPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center" style={{background:'#07080f'}}><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>}>
      <DisplayPageInner />
    </Suspense>
  )
}

function DisplayPageInner() {
  const searchParams = useSearchParams()
  const shopId = searchParams.get('shopId') || SHOP_ID
  const [round,    setRound]    = useState<any>(null)
  const [bets,     setBets]     = useState<any[]>([])
  const [summary,  setSummary]  = useState<any>(null)
  const [top10,    setTop10]    = useState<any[]>([])
  const [topMonth, setTopMonth] = useState<any[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [clock,    setClock]    = useState<Date|null>(null)
  const [showMonth,setShowMonth]= useState(false)
  const timerRef = useRef<any>()
  const clockRef = useRef<any>()

  useEffect(() => {
    setClock(new Date())
    clockRef.current = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(clockRef.current)
  }, [])

  const fetchAll = async () => {
    try {
      const r = (await betApi.getCurrentRound(shopId)).data.round
      setRound(r)
      if (r?.id && (r.status === 'open' || r.status === 'locked')) {
        const b = (await staffApi.getRoundBets(r.id)).data?.bets || []
        setBets(b)
      } else if (!r) setBets([])
      if (r?.status === 'open' && r.openedAt) {
        const elapsed = Date.now() - new Date(r.openedAt).getTime()
        setTimeLeft(Math.max(0, Math.floor((180_000 - elapsed) / 1000)))
      }
    } catch {}
    try {
      const s = (await staffApi.summary(shopId)).data
      setSummary(s)
    } catch {}
  }

  const fetchTop = async () => {
    try {
      const [a, b] = await Promise.all([
        leaderboardApi.get(shopId, 'today'),
        leaderboardApi.get(shopId, 'month'),
      ])
      setTop10(a.data || [])
      setTopMonth(b.data || [])
    } catch {}
  }

  useEffect(() => {
    fetchAll(); fetchTop()
    const t1 = setInterval(fetchAll, 3000)
    const t2 = setInterval(fetchTop, 30_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [shopId])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (round?.status === 'open' && timeLeft > 0)
      timerRef.current = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(timerRef.current)
  }, [round?.status, timeLeft])

  useEffect(() => {
    const s = connectSocket(shopId)
    s.on('round:opened', fetchAll)
    s.on('round:settled', () => { fetchAll(); fetchTop() })
    s.on('round:stopped', fetchAll)
    s.on('odds:update', fetchAll)
    return () => { s.off('round:opened').off('round:settled').off('round:stopped').off('odds:update') }
  }, [shopId])

  useEffect(() => {
    const t = setInterval(() => setShowMonth(p => !p), 10_000)
    return () => clearInterval(t)
  }, [])

  const total   = (round?.totalEven || 0) + (round?.totalOdd || 0)
  const evenPct = total > 0 ? (round.totalEven / total) * 100 : 50
  const oddPct  = 100 - evenPct
  const mins    = Math.floor(timeLeft / 60)
  const secs    = timeLeft % 60
  const warn    = timeLeft > 0 && timeLeft <= 30
  const evenB   = bets.filter(b => b.side === 'even')
  const oddB    = bets.filter(b => b.side === 'odd')
  const pad2    = (n: number) => String(n).padStart(2, '0')
  const allRes  = summary?.rounds?.filter((r: any) => r.result) || []
  const evenCnt = allRes.filter((r: any) => r.result === 'even').length
  const oddCnt  = allRes.filter((r: any) => r.result === 'odd').length
  const ranked  = showMonth ? topMonth : top10

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col select-none"
      style={{ fontFamily:"'Sarabun',sans-serif", background:'#07080f', color:'white' }}>

      {/* ── Mesh BG ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex:0 }}>
        <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 60% 40% at 20% 30%,rgba(37,99,235,0.12),transparent),radial-gradient(ellipse 50% 35% at 80% 20%,rgba(168,85,247,0.09),transparent),radial-gradient(ellipse 40% 30% at 50% 80%,rgba(6,182,212,0.07),transparent)' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />
      </div>
      {/* ── Logo watermark ── */}
      <LogoBg opacity={0.05} />

      {/* ── TOP BAR ── */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 shrink-0"
        style={{ background:'linear-gradient(135deg,rgba(13,27,62,0.95),rgba(10,14,26,0.98))', borderBottom:'1px solid rgba(79,159,255,0.15)', boxShadow:'0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(79,159,255,0.1)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 blur-xl opacity-40 rounded-full" style={{ background:'#1d4ed8', transform:'scale(1.6)' }} />
            <Logo size={72} className="relative drop-shadow-lg" />
          </div>
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase mt-1" style={{ color:'rgba(79,159,255,0.5)' }}>LIVE BETTING SYSTEM</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          {[
            { icon:'🎯', label:'รอบวันนี้',    value: summary?.totalRounds ?? 0, unit:'รอบ', color:'#60a5fa' },
            { icon:'💰', label:'ยอดวันนี้ (฿)', value: summary?.totalVolume ?? 0, unit:'฿',   color:'#34d399', big: true },
            { icon:'👥', label:'ผู้แทงรอบนี้',  value: bets.length,               unit:'ราย', color:'#a78bfa' },
          ].map(s => (
            <div key={s.label} className="text-center px-4 py-2 rounded-2xl"
              style={{ background:(s as any).big ? `${s.color}14` : 'rgba(255,255,255,0.04)', border:`1px solid ${(s as any).big ? s.color+'30' : 'rgba(255,255,255,0.07)'}`, boxShadow:(s as any).big ? `0 0 20px ${s.color}25, inset 0 1px 0 rgba(255,255,255,0.06)` : 'inset 0 1px 0 rgba(255,255,255,0.06)', minWidth:(s as any).big?'160px':'100px' }}>
              <p className="text-[10px] mb-0.5 font-bold" style={{ color:(s as any).big ? `${s.color}cc` : 'rgba(255,255,255,0.3)' }}>{s.icon} {s.label}</p>
              <p className={(s as any).big ? 'text-3xl font-black leading-none' : 'text-xl font-black leading-none'} style={{ color: s.color, textShadow:`0 0 15px ${s.color}60` }}>
                <Counter value={s.value} />
                <span className="text-xs ml-1" style={{ color:'rgba(255,255,255,0.25)' }}>{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Clock */}
        <div className="text-right">
          <p className="text-4xl font-black tabular-nums" style={{ color:'white', textShadow:'0 0 20px rgba(79,159,255,0.4)' }}>
            {clock ? `${pad2(clock.getHours())}:${pad2(clock.getMinutes())}:${pad2(clock.getSeconds())}` : '--:--:--'}
          </p>
          <p className="text-xs" style={{ color:'rgba(79,159,255,0.5)' }}>
            {clock?.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}) ?? ''}
          </p>
        </div>
      </div>

      {/* ── 3-COL ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* LEFT — คู่ */}
        <div className="w-[26%] flex flex-col overflow-hidden"
          style={{ background:'linear-gradient(180deg,rgba(12,26,58,0.9) 0%,rgba(8,16,40,0.95) 100%)', borderRight:'1px solid rgba(59,130,246,0.15)' }}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom:'1px solid rgba(59,130,246,0.12)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-5xl" style={{ filter:'drop-shadow(0 0 12px rgba(59,130,246,0.8))' }}>🔵</span>
                <div>
                  <p className="text-3xl font-black" style={{ color:'#93c5fd', textShadow:'0 0 20px rgba(147,197,253,0.5)' }}>คู่</p>
                  <p className="text-xs" style={{ color:'rgba(147,197,253,0.4)' }}>{evenB.length} ราย</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black tabular-nums" style={{ color:'white', textShadow:'0 0 15px rgba(59,130,246,0.4)' }}>
                  <Counter value={round?.totalEven || 0} />
                </p>
                <p className="text-xs" style={{ color:'rgba(147,197,253,0.4)' }}>฿</p>
              </div>
            </div>
            {/* Pct pill */}
            <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-full"
              style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)' }}>
              <span className="text-xs font-bold" style={{ color:'#93c5fd' }}>สัดส่วน</span>
              <span className="text-lg font-black" style={{ color:'#60a5fa' }}>{evenPct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Bet list */}
          <div className="flex-1 overflow-hidden px-3 py-2 space-y-1">
            {evenB.length === 0
              ? <div className="h-full flex items-center justify-center text-sm" style={{ color:'rgba(59,130,246,0.2)' }}>ยังไม่มีการแทง</div>
              : evenB.slice(0, 12).map((b: any, i) => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.1)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                  <span className="text-sm truncate max-w-[130px]" style={{ color:'rgba(147,197,253,0.9)' }}>{b.user?.displayName}</span>
                  <span className="font-black text-sm tabular-nums" style={{ color:'white' }}>{b.amountAccepted?.toLocaleString()}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* CENTER */}
        <div className="flex-1 flex flex-col items-center justify-between py-4 px-4 overflow-hidden"
          style={{ background:'rgba(7,8,15,0.6)' }}>

          {/* Status */}
          <div className={`px-6 py-2 rounded-full text-sm font-black tracking-wider ${
            round?.status === 'open' ? 'animate-pulse' : ''
          }`} style={{
            background: round?.status === 'open'   ? 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1))' :
                        round?.status === 'locked'  ? 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.1))' :
                        round?.status === 'settled' ? 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(168,85,247,0.1))' :
                        'rgba(255,255,255,0.05)',
            border: round?.status === 'open'   ? '1px solid rgba(16,185,129,0.4)' :
                    round?.status === 'locked'  ? '1px solid rgba(245,158,11,0.4)' :
                    round?.status === 'settled' ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: round?.status === 'open'   ? '0 0 20px rgba(16,185,129,0.2)' :
                       round?.status === 'locked'  ? '0 0 20px rgba(245,158,11,0.2)' : 'none',
            color: round?.status === 'open'   ? '#6ee7b7' :
                   round?.status === 'locked'  ? '#fcd34d' :
                   round?.status === 'settled' ? '#c4b5fd' : 'rgba(255,255,255,0.3)',
          }}>
            {round?.status === 'open' ? '● เปิดรับแทง' : round?.status === 'locked' ? '◉ ปิดรับแทง' :
             round?.status === 'settled' ? `✦ ผล: ${round.result === 'even' ? 'คู่' : 'คี่'}` : '○ รอรอบใหม่'}
          </div>

          {/* TIMER / RESULT BIG */}
          <div className="text-center">
            {round?.status === 'open' && timeLeft > 0 ? (
              <>
                <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color:'rgba(255,255,255,0.2)' }}>TIME REMAINING</p>
                <p className="font-black tabular-nums leading-none" style={{
                  fontSize: '9rem',
                  color: warn ? '#f87171' : 'white',
                  textShadow: warn
                    ? '0 0 40px rgba(248,113,113,0.8), 0 0 80px rgba(248,113,113,0.4)'
                    : '0 0 40px rgba(79,159,255,0.5), 0 0 80px rgba(79,159,255,0.2)',
                  animation: warn ? 'glow-pulse 0.8s ease-in-out infinite' : 'none',
                }}>
                  {pad2(mins)}:{pad2(secs)}
                </p>
              </>
            ) : round?.status === 'settled' && round.result ? (
              <div className="text-center">
                <div className="text-[7rem] leading-none mb-3"
                  style={{ filter:`drop-shadow(0 0 30px ${round.result === 'even' ? 'rgba(59,130,246,0.8)' : 'rgba(245,158,11,0.8)'})` }}>
                  {round.result === 'even' ? '🔵' : '🟡'}
                </div>
                <p className="text-6xl font-black" style={{
                  color: round.result === 'even' ? '#60a5fa' : '#fbbf24',
                  textShadow: `0 0 30px ${round.result === 'even' ? 'rgba(96,165,250,0.6)' : 'rgba(251,191,36,0.6)'}`,
                }}>
                  {round.result === 'even' ? 'คู่ชนะ!' : 'คี่ชนะ!'}
                </p>
              </div>
            ) : round?.status === 'locked' ? (
              <div className="text-center">
                <p className="text-[5rem] leading-none mb-3" style={{ filter:'drop-shadow(0 0 20px rgba(245,158,11,0.6))' }}>🔒</p>
                <p className="text-3xl font-bold" style={{ color:'#fcd34d' }}>กำลังรอผล...</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[5rem] leading-none mb-3 animate-float">🦐</p>
                <p className="text-2xl" style={{ color:'rgba(255,255,255,0.2)' }}>รอเปิดรอบ</p>
              </div>
            )}
          </div>

          {/* Odds bar — 3D */}
          {total > 0 && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs px-1">
                <span className="font-bold" style={{ color:'#60a5fa' }}>🔵 {evenPct.toFixed(1)}%</span>
                <span style={{ color:'rgba(255,255,255,0.2)' }}>รวม {total.toLocaleString()} ฿</span>
                <span className="font-bold" style={{ color:'#fbbf24' }}>{oddPct.toFixed(1)}% 🟡</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden"
                style={{ background:'rgba(255,255,255,0.05)', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.4)' }}>
                <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000"
                  style={{ width:`${evenPct}%`, background:'linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)', boxShadow:'2px 0 12px rgba(59,130,246,0.5)' }} />
                <div className="absolute right-0 top-0 bottom-0 rounded-full transition-all duration-1000"
                  style={{ width:`${oddPct}%`, background:'linear-gradient(270deg,#b45309,#d97706,#fbbf24)', boxShadow:'-2px 0 12px rgba(245,158,11,0.5)' }} />
                <div className="absolute inset-0 rounded-full" style={{ background:'linear-gradient(180deg,rgba(255,255,255,0.15),transparent)' }} />
              </div>
            </div>
          )}

          {/* Daily result circles */}
          <div className="w-full space-y-2">
            {(allRes.length > 0) && (
              <div className="flex justify-center gap-3">
                {[{ label:'คู่', count:evenCnt, color:'#3b82f6', glow:'rgba(59,130,246,0.5)' },
                  { label:'คี่', count:oddCnt,  color:'#f59e0b', glow:'rgba(245,158,11,0.5)' }].map(s => (
                  <div key={s.label} className="flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{ background:`${s.color}18`, border:`1px solid ${s.color}30` }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background:s.color, boxShadow:`0 0 12px ${s.glow}` }}>{s.label}</div>
                    <span className="font-black text-xl" style={{ color:s.color, textShadow:`0 0 10px ${s.glow}` }}>{s.count}</span>
                    <span className="text-xs" style={{ color:'rgba(255,255,255,0.2)' }}>รอบ</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-1.5 max-h-16 overflow-hidden">
              {allRes.map((r: any, i: number) => (
                <div key={i} className="w-10 h-10 rounded-full flex flex-col items-center justify-center font-black transition-all"
                  style={{
                    background: r.result === 'even'
                      ? 'linear-gradient(135deg,#1d4ed8,#3b82f6)'
                      : 'linear-gradient(135deg,#b45309,#f59e0b)',
                    boxShadow: r.result === 'even'
                      ? '0 2px 8px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                      : '0 2px 8px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}>
                  <span style={{ fontSize:14 }}>{r.result === 'even' ? '🔵' : '🟡'}</span>
                  <span style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>{r.result === 'even' ? 'คู่' : 'คี่'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 10 leaderboard */}
          <div className="w-full rounded-2xl overflow-hidden"
            style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b"
              style={{ borderColor:'rgba(255,255,255,0.05)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color:'rgba(255,255,255,0.3)' }}>
                {showMonth ? '📅 TOP เดือนนี้' : '🏆 TOP วันนี้'}
              </p>
              <div className="flex gap-1">
                {[false,true].map(m => (
                  <span key={String(m)} className="w-1.5 h-1.5 rounded-full" style={{ background: showMonth === m ? '#60a5fa' : 'rgba(255,255,255,0.1)' }} />
                ))}
              </div>
            </div>
            <div className="px-3 py-2 space-y-1">
              {ranked.slice(0, 7).map((e: any, i: number) => (
                <div key={e.userId} className="flex items-center gap-2">
                  <span className="w-5 text-center shrink-0 text-sm">
                    {i < 3 ? ['🥇','🥈','🥉'][i] : <span style={{ color:'rgba(255,255,255,0.2)', fontSize:11 }}>#{i+1}</span>}
                  </span>
                  <span className="flex-1 text-xs truncate" style={{ color:'rgba(255,255,255,0.7)' }}>{e.displayName}</span>
                  <span className="font-black text-xs tabular-nums" style={{ color:'#4ade80' }}>{e.totalPayout?.toLocaleString()} ฿</span>
                </div>
              ))}
              {ranked.length === 0 && <p className="text-center text-xs py-2" style={{ color:'rgba(255,255,255,0.1)' }}>ยังไม่มีข้อมูล</p>}
            </div>
          </div>
        </div>

        {/* RIGHT — คี่ */}
        <div className="w-[26%] flex flex-col overflow-hidden"
          style={{ background:'linear-gradient(180deg,rgba(40,18,2,0.9) 0%,rgba(20,8,0,0.95) 100%)', borderLeft:'1px solid rgba(245,158,11,0.15)' }}>

          <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom:'1px solid rgba(245,158,11,0.12)' }}>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-3xl font-black tabular-nums" style={{ color:'white', textShadow:'0 0 15px rgba(245,158,11,0.4)' }}>
                  <Counter value={round?.totalOdd || 0} />
                </p>
                <p className="text-xs" style={{ color:'rgba(251,191,36,0.4)' }}>฿</p>
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-3xl font-black text-right" style={{ color:'#fcd34d', textShadow:'0 0 20px rgba(252,211,77,0.5)' }}>คี่</p>
                  <p className="text-xs text-right" style={{ color:'rgba(251,191,36,0.4)' }}>{oddB.length} ราย</p>
                </div>
                <span className="text-5xl" style={{ filter:'drop-shadow(0 0 12px rgba(245,158,11,0.8))' }}>🟡</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-full"
              style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <span className="text-xs font-bold" style={{ color:'#fcd34d' }}>สัดส่วน</span>
              <span className="text-lg font-black" style={{ color:'#fbbf24' }}>{oddPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-3 py-2 space-y-1">
            {oddB.length === 0
              ? <div className="h-full flex items-center justify-center text-sm" style={{ color:'rgba(245,158,11,0.2)' }}>ยังไม่มีการแทง</div>
              : oddB.slice(0, 12).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.1)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                  <span className="text-sm truncate max-w-[130px]" style={{ color:'rgba(252,211,77,0.9)' }}>{b.user?.displayName}</span>
                  <span className="font-black text-sm tabular-nums" style={{ color:'white' }}>{b.amountAccepted?.toLocaleString()}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="relative z-10 shrink-0 py-2 overflow-hidden"
        style={{ background:'rgba(0,0,0,0.5)', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        {bets.length > 0 ? (
          <div className="overflow-hidden whitespace-nowrap">
            <div className="inline-flex gap-5 animate-[slide_25s_linear_infinite]">
              {[...bets, ...bets].map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
                  style={b.side === 'even'
                    ? { background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.25)', color:'#93c5fd' }
                    : { background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.25)', color:'#fcd34d' }}>
                  {b.side === 'even' ? '🔵' : '🟡'} {b.user?.displayName} · {b.amountAccepted?.toLocaleString()} ฿
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center text-xs" style={{ color:'rgba(255,255,255,0.1)' }}>กำลังรอการแทง...</p>
        )}
      </div>

      <style jsx global>{`
        @keyframes slide { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes glow-pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        body { overflow: hidden; }
      `}</style>
    </div>
  )
}
