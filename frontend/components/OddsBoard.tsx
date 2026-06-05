'use client'
import { useRoundStore } from '@/store/round'

export function OddsBoard() {
  const { round, timeLeft } = useRoundStore()
  const total   = (round?.totalEven || 0) + (round?.totalOdd || 0)
  const evenPct = total > 0 ? (round!.totalEven / total) * 100 : 50
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const warn = timeLeft > 0 && timeLeft <= 30

  if (!round) return (
    <div className="card-3d text-center py-10 space-y-3">
      <div className="text-6xl animate-float">🦐</div>
      <p className="font-bold text-gray-400 text-lg">รอรอบใหม่...</p>
      <div className="flex justify-center gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: `${i*0.2}s` }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="card-3d space-y-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: round.status === 'open' ? '#3b82f6' : round.status === 'settled' ? '#a855f7' : '#f59e0b' }} />

      {/* Status row */}
      <div className="relative flex items-center justify-between">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
          round.status === 'open'    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          round.status === 'locked'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          round.status === 'settled' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
          'bg-gray-100 text-gray-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            round.status === 'open' ? 'bg-emerald-500 animate-pulse' :
            round.status === 'locked' ? 'bg-amber-500' : 'bg-purple-500'
          }`} />
          {round.status === 'open' ? 'เปิดรับแทง' : round.status === 'locked' ? 'ปิดรับแทง' :
           round.status === 'settled' ? 'ออกผลแล้ว' : 'ยกเลิก'}
        </div>

        {round.status === 'open' && timeLeft > 0 && (
          <div className={`font-black text-3xl tabular-nums tracking-tighter ${
            warn ? 'text-red-500 animate-pulse' : 'text-gradient-primary'
          }`} style={warn ? {} : {
            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </div>
        )}

        {round.result && (
          <div className={`font-black text-xl ${round.result === 'even' ? 'text-blue-600' : 'text-amber-500'}`}>
            ผล: {round.result === 'even' ? '🔵 คู่' : '🟡 คี่'}
          </div>
        )}
      </div>

      {/* Odds columns — 3D style */}
      <div className="grid grid-cols-2 gap-3">
        {/* Even */}
        <div className="rounded-2xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(160deg,#eff6ff,#dbeafe)',
            border: '1.5px solid rgba(59,130,246,0.2)',
            boxShadow: '0 2px 8px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
          <div className="px-4 py-3 text-center">
            <p className="text-3xl">🔵</p>
            <p className="font-black text-blue-700 text-2xl mt-1 tabular-nums">
              {(round.totalEven||0).toLocaleString()}
            </p>
            <p className="text-blue-400 text-xs font-semibold">฿ ฝั่งคู่</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: 'linear-gradient(90deg,transparent,#3b82f6,transparent)' }} />
        </div>

        {/* Odd */}
        <div className="rounded-2xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(160deg,#fffbeb,#fef3c7)',
            border: '1.5px solid rgba(245,158,11,0.2)',
            boxShadow: '0 2px 8px rgba(245,158,11,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
          <div className="px-4 py-3 text-center">
            <p className="text-3xl">🟡</p>
            <p className="font-black text-amber-600 text-2xl mt-1 tabular-nums">
              {(round.totalOdd||0).toLocaleString()}
            </p>
            <p className="text-amber-400 text-xs font-semibold">฿ ฝั่งคี่</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)' }} />
        </div>
      </div>

      {/* Odds bar — 3D layered */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="relative h-3 rounded-full overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.06)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }}>
            <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-700"
              style={{
                width: `${evenPct}%`,
                background: 'linear-gradient(90deg,#2563eb,#3b82f6,#60a5fa)',
                boxShadow: '2px 0 8px rgba(37,99,235,0.4)',
              }} />
            <div className="absolute right-0 top-0 bottom-0 rounded-full transition-all duration-700"
              style={{
                width: `${100-evenPct}%`,
                background: 'linear-gradient(270deg,#b45309,#d97706,#f59e0b)',
                boxShadow: '-2px 0 8px rgba(217,119,6,0.4)',
              }} />
            {/* Highlight */}
            <div className="absolute inset-x-0 top-0 h-1/2 rounded-full"
              style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.3),transparent)' }} />
          </div>
          <div className="flex justify-between text-xs px-0.5">
            <span className="text-blue-500 font-bold">🔵 {evenPct.toFixed(1)}%</span>
            <span className="text-gray-400">รวม {total.toLocaleString()} ฿</span>
            <span className="text-amber-500 font-bold">{(100-evenPct).toFixed(1)}% 🟡</span>
          </div>
        </div>
      )}
    </div>
  )
}
