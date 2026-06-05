'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, api } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { Skeleton } from '@/components/ui/Skeleton'

// Pure SVG bar chart — no external chart library needed
function BarChart({
  data, xKey, yKey, label, color = '#3b82f6', height = 140,
}: {
  data: any[]; xKey: string; yKey: string; label: string; color?: string; height?: number
}) {
  if (!data?.length) return <div className="h-36 flex items-center justify-center text-gray-300 text-sm">ไม่มีข้อมูล</div>
  const maxVal = Math.max(...data.map(d => d[yKey]), 1)
  const w = 100 / data.length

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <svg viewBox={`0 0 ${data.length * 28} ${height + 24}`} className="w-full overflow-visible">
        {data.map((d, i) => {
          const barH = ((d[yKey] / maxVal) * height) || 0
          const x = i * 28 + 3
          const y = height - barH
          return (
            <g key={i}>
              <rect x={x} y={y} width={22} height={barH} fill={color} rx={3} opacity={0.85} />
              <text x={x + 11} y={height + 14} textAnchor="middle" fontSize={7} fill="#9ca3af">
                {String(d[xKey]).slice(0, 5)}
              </text>
              {barH > 16 && (
                <text x={x + 11} y={y + 10} textAnchor="middle" fontSize={7} fill="white" fontWeight="600">
                  {d[yKey] > 999 ? `${(d[yKey]/1000).toFixed(1)}k` : d[yKey]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Donut chart for even/odd split
function DonutChart({ even, odd }: { even: number; odd: number }) {
  const total = even + odd || 1
  const evenPct = (even / total) * 100
  const r = 40; const circ = 2 * Math.PI * r
  const evenDash = (evenPct / 100) * circ

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28">
        {/* Background */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#fde68a" strokeWidth="18" />
        {/* Even slice */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#3b82f6" strokeWidth="18"
          strokeDasharray={`${evenDash} ${circ - evenDash}`}
          strokeDashoffset={circ * 0.25} // rotate -90deg
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e3a8a">
          {evenPct.toFixed(0)}%
        </text>
        <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#6b7280">คู่</text>
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
          <span>🔵 คู่ — <strong>{even}</strong> รอบ ({evenPct.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
          <span>🟡 คี่ — <strong>{odd}</strong> รอบ ({(100-evenPct).toFixed(1)}%)</span>
        </div>
        <p className="text-xs text-gray-400 pt-1">รวม {total} รอบที่ออกผล</p>
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  const [shopId, setShopId]   = useState('')
  const [days, setDays]       = useState('14')
  const [period, setPeriod]   = useState<'14'|'30'|'90'>('14')

  const { data: shops } = useQuery({
    queryKey: ['adminShops'],
    queryFn:  () => adminApi.getShops().then(r => r.data),
  })

  const queryOpts = { shopId: shopId || undefined, days: parseInt(days) }

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['analyticsDaily', shopId, days],
    queryFn:  () => api.get(`/analytics/daily?days=${days}${shopId ? `&shopId=${shopId}` : ''}`).then(r => r.data),
  })

  const { data: hourly } = useQuery({
    queryKey: ['analyticsHourly', shopId],
    queryFn:  () => api.get(`/analytics/volume${shopId ? `?shopId=${shopId}` : ''}`).then(r => r.data),
  })

  const { data: evenOdd } = useQuery({
    queryKey: ['analyticsEvenOdd', shopId, days],
    queryFn:  () => api.get(`/analytics/even-odd?days=${days}${shopId ? `&shopId=${shopId}` : ''}`).then(r => r.data),
  })

  const { data: topBettors } = useQuery({
    queryKey: ['analyticsTopBettors', shopId, days],
    queryFn:  () => api.get(`/analytics/top-bettors?days=${days}${shopId ? `&shopId=${shopId}` : ''}`).then(r => r.data),
  })

  // Summary from daily data
  const totalVol  = daily?.reduce((s: number, d: any) => s + d.volume, 0) ?? 0
  const totalRnds = daily?.reduce((s: number, d: any) => s + d.rounds, 0) ?? 0
  const totalFee  = daily?.reduce((s: number, d: any) => s + d.fee, 0) ?? 0
  const avgPerDay = totalRnds > 0 ? (totalVol / parseInt(days)).toFixed(0) : '0'

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">📈 Analytics</h1>
        <p className="text-gray-500 text-sm">วิเคราะห์ข้อมูลเชิงลึก</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={shopId} onChange={e => setShopId(e.target.value)} className="input text-sm w-40">
          <option value="">ทุกร้าน</option>
          {shops?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex bg-white rounded-xl border border-gray-200 p-0.5">
          {(['14','30','90'] as const).map(d => (
            <button key={d} onClick={() => { setPeriod(d); setDays(d) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === d ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {d} วัน
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="💵" label={`ยอดรวม ${days} วัน`}   value={`${totalVol.toLocaleString()} ฿`}   color="blue"   />
        <StatCard icon="🎯" label="รอบที่เกิดขึ้น"          value={totalRnds}                            color="purple" />
        <StatCard icon="💰" label="รายได้รวม (10%)"         value={`${totalFee.toLocaleString()} ฿`}    color="green"  />
        <StatCard icon="📊" label="เฉลี่ยต่อวัน"            value={`${parseInt(avgPerDay).toLocaleString()} ฿`} color="amber" />
      </div>

      {/* Daily volume chart */}
      <div className="card">
        <h2 className="font-bold text-gray-800 mb-4">📊 ยอดรายวัน (฿)</h2>
        {dailyLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <BarChart
            data={daily ?? []} xKey="date" yKey="volume"
            label="ยอดเดิมพันรายวัน" color="#3b82f6" height={120}
          />
        )}
      </div>

      {/* Rounds per day */}
      <div className="card">
        <h2 className="font-bold text-gray-800 mb-4">🎯 จำนวนรอบรายวัน</h2>
        <BarChart
          data={daily ?? []} xKey="date" yKey="rounds"
          label="จำนวนรอบ" color="#8b5cf6" height={100}
        />
      </div>

      {/* Hourly volume (today) */}
      <div className="card">
        <h2 className="font-bold text-gray-800 mb-4">⏰ ยอดรายชั่วโมง (24 ชม.ที่ผ่านมา)</h2>
        <BarChart
          data={hourly ?? []} xKey="label" yKey="volume"
          label="ยอดแต่ละชั่วโมง" color="#10b981" height={100}
        />
      </div>

      {/* Even vs Odd + Top bettors — side by side on desktop */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Even/Odd donut */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-4">🔵🟡 สัดส่วนคู่/คี่</h2>
          {evenOdd ? (
            <DonutChart even={evenOdd.even} odd={evenOdd.odd} />
          ) : (
            <Skeleton className="h-28 w-full rounded-2xl" />
          )}
        </div>

        {/* Top bettors */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-3">🏆 Top 10 ผู้แทงสูงสุด</h2>
          {!topBettors ? (
            <Skeleton className="h-40 w-full" />
          ) : topBettors.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-2">
              {topBettors.map((b: any) => (
                <div key={b.rank} className="flex items-center gap-3">
                  <span className="text-lg w-6 shrink-0">{b.rank <= 3 ? ['🥇','🥈','🥉'][b.rank-1] : `${b.rank}.`}</span>
                  <span className="flex-1 font-medium text-sm truncate">{b.displayName}</span>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{b.totalWagered.toLocaleString()} ฿</p>
                    <p className={`text-xs font-medium ${b.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {b.netProfit >= 0 ? '+' : ''}{b.netProfit.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue bar */}
      <div className="card">
        <h2 className="font-bold text-gray-800 mb-4">💰 รายได้รายวัน (฿)</h2>
        <BarChart
          data={daily ?? []} xKey="date" yKey="fee"
          label="รายได้ร้าน 10%" color="#f59e0b" height={80}
        />
      </div>
    </div>
  )
}
