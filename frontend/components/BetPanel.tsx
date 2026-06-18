'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { betApi } from '@/lib/api'
import { useRoundStore } from '@/store/round'

const QUICK = [50, 100, 200, 500, 1000]

interface Props { roundId: string; walletBalance: number; onBetPlaced: () => void }

export function BetPanel({ roundId, walletBalance, onBetPlaced }: Props) {
  const [side, setSide]     = useState<'even'|'odd'|null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const { addBet } = useRoundStore()

  const num   = parseFloat(amount) || 0
  const get   = num * 0.9
  const valid = side && num >= 10 && num <= walletBalance

  async function bet() {
    if (!valid) return
    setLoading(true)
    try {
      const res = await betApi.placeBet(roundId, side!, num)
      addBet(res.data)
      toast.success(`✅ แทง${side === 'even' ? 'คู่' : 'คี่'} ${res.data.amountAccepted.toLocaleString()} ฿`)
      setAmount(''); setSide(null); onBetPlaced()
    } catch (e: any) { toast.error(e.response?.data?.error || 'เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="card-3d space-y-4 relative overflow-hidden">
      {/* bg glow */}
      {side && <div className={`absolute -bottom-8 inset-x-0 h-32 blur-3xl opacity-15 pointer-events-none
        ${side === 'even' ? 'bg-blue-500' : 'bg-amber-400'}`} />}

      <div className="relative flex items-center justify-between">
        <h3 className="font-black text-gray-900 text-xl">วางเดิมพัน</h3>
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
          <span className="text-gray-400 text-xs">เครดิต</span>
          <span className="font-black text-gray-800">{walletBalance.toLocaleString()}</span>
          <span className="text-gray-400 text-xs">฿</span>
        </div>
      </div>

      {/* Side buttons — 3D */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setSide('even')}
          className={`py-6 text-2xl font-black rounded-2xl transition-all duration-200 ${
            side === 'even' ? 'btn-even' : ''
          }`}
          style={side !== 'even' ? {
            background: 'linear-gradient(160deg,#eff6ff,#dbeafe)',
            border: '2px solid rgba(59,130,246,0.25)',
            color: '#2563eb',
            boxShadow: '0 2px 0 rgba(37,99,235,0.2), 0 4px 12px rgba(59,130,246,0.1)',
          } : {}}>
          🔵 คู่
        </button>
        <button onClick={() => setSide('odd')}
          className={`py-6 text-2xl font-black rounded-2xl transition-all duration-200 ${
            side === 'odd' ? 'btn-odd' : ''
          }`}
          style={side !== 'odd' ? {
            background: 'linear-gradient(160deg,#fffbeb,#fef3c7)',
            border: '2px solid rgba(245,158,11,0.25)',
            color: '#d97706',
            boxShadow: '0 2px 0 rgba(180,83,9,0.2), 0 4px 12px rgba(245,158,11,0.1)',
          } : {}}>
          🟡 คี่
        </button>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-2 flex-wrap">
        {QUICK.map(a => (
          <button key={a} onClick={() => setAmount(a.toString())}
            className="px-3.5 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: amount === a.toString()
                ? 'linear-gradient(135deg,#1e40af,#2563eb)'
                : 'rgba(0,0,0,0.04)',
              color:  amount === a.toString() ? 'white' : '#374151',
              border: amount === a.toString() ? 'none' : '1.5px solid rgba(0,0,0,0.08)',
              boxShadow: amount === a.toString()
                ? '0 2px 0 #1a3f9f, 0 4px 12px rgba(37,99,235,0.3)'
                : '0 1px 0 rgba(0,0,0,0.06)',
              transform: amount === a.toString() ? 'translateY(-1px)' : 'none',
            }}>
            {a >= 1000 ? `${a/1000}K` : a}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="relative">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          className="w-full text-xl font-bold pr-14 py-4 rounded-2xl transition-all focus:outline-none"
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: side === 'even' ? '2px solid rgba(59,130,246,0.4)' :
                    side === 'odd'  ? '2px solid rgba(245,158,11,0.4)' : '2px solid rgba(0,0,0,0.08)',
            boxShadow: side === 'even' ? '0 0 0 4px rgba(59,130,246,0.08)' :
                       side === 'odd'  ? '0 0 0 4px rgba(245,158,11,0.08)' : 'none',
            paddingLeft: 16,
          }}
          placeholder="จำนวนเงิน" inputMode="numeric" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">฿</span>
      </div>

      {/* Expected return */}
      {num >= 10 && side && (
        <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{
            background: side === 'even' ? 'linear-gradient(135deg,#eff6ff,#dbeafe)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)',
            border: side === 'even' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(245,158,11,0.2)',
          }}>
          <span className="text-sm text-gray-500 font-medium">💰 คาดว่าจะได้รับ</span>
          <span className={`font-black text-xl tabular-nums ${side === 'even' ? 'text-blue-600' : 'text-amber-600'}`}>
            +{get.toLocaleString('th-TH',{maximumFractionDigits:0})} ฿
          </span>
        </div>
      )}

      {/* CTA */}
      <button onClick={bet} disabled={!valid || loading}
        className={`w-full py-4 rounded-2xl font-black text-xl transition-all ${
          side === 'even' ? 'btn-even' :
          side === 'odd'  ? 'btn-odd'  : ''
        }`}
        style={!side ? {
          background: 'rgba(0,0,0,0.06)',
          color: '#9ca3af',
          cursor: 'not-allowed',
          borderRadius: '1rem',
        } : {}}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            กำลังแทง...
          </span>
        ) : !side ? 'เลือกฝั่งก่อน' :
          !num ? 'กรอกจำนวนเงิน' :
          num < 10 ? 'ขั้นต่ำ 10 ฿' :
          num > walletBalance ? 'เครดิตไม่พอ' :
          `แทง${side === 'even' ? '🔵 คู่' : '🟡 คี่'} ${num.toLocaleString()} ฿`}
      </button>
    </div>
  )
}
