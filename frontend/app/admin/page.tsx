'use client'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { CardSkeleton } from '@/components/ui/Skeleton'

export default function AdminDashboard() {
  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['adminRevenue'],
    queryFn: () => adminApi.getRevenue().then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: shops, isLoading: shopsLoading } = useQuery({
    queryKey: ['adminShops'],
    queryFn: () => adminApi.getShops().then(r => r.data),
  })

  const { data: revenueByShop } = useQuery({
    queryKey: ['revenueByShop'],
    queryFn: () => adminApi.getRevenueByShop().then(r => r.data),
  })

  const { data: withdrawals } = useQuery({
    queryKey: ['withdrawals'],
    queryFn: () => adminApi.getWithdrawals().then(r => r.data),
  })

  const today = new Date().toISOString().split('T')[0]
  const todayData = revenue?.byDay?.find((d: any) => d.date === today)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">ภาพรวมระบบ 30 วันล่าสุด</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href="/display" target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
            style={{ background:'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow:'0 3px 0 #1a3f9f, 0 5px 14px rgba(37,99,235,0.35)' }}>
            🖥️ จอในร้าน
          </a>
          <a href="/stats" target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
            style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', boxShadow:'0 3px 0 #4c1d95, 0 5px 14px rgba(168,85,247,0.35)' }}>
            🏆 สถิติ
          </a>
          <a href="/staff"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
            style={{ background:'linear-gradient(135deg,#059669,#10b981)', boxShadow:'0 3px 0 #065f46, 0 5px 14px rgba(16,185,129,0.35)' }}>
            🎮 ควบคุมรอบ
          </a>
        </div>
      </div>

      {/* Summary stats */}
      {revLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon="🎯" label="รอบทั้งหมด" value={revenue?.summary?.totalRounds ?? 0} color="blue" />
          <StatCard icon="💵" label="ยอดเงินรวม" value={`${(revenue?.summary?.totalVolume ?? 0).toLocaleString()} ฿`} color="purple" />
          <StatCard icon="💰" label="รายได้ร้าน (10%)" value={`${(revenue?.summary?.shopFee ?? 0).toLocaleString()} ฿`} color="green" />
          <StatCard icon="⚠️" label="รอถอนเงิน" value={withdrawals?.length ?? 0} color={withdrawals?.length > 0 ? 'red' : 'blue'} />
        </div>
      )}

      {/* Today stats */}
      <div className="card">
        <h2 className="font-bold text-gray-800 mb-3">📅 วันนี้</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-gray-400 text-sm">รอบ</p>
            <p className="text-2xl font-bold text-gray-900">{todayData?.rounds ?? 0}</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-gray-400 text-sm">ยอด</p>
            <p className="text-xl font-bold text-gray-900">{(todayData?.volume ?? 0).toLocaleString()} ฿</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">รายได้</p>
            <p className="text-xl font-bold text-green-600">{(todayData?.fee ?? 0).toLocaleString()} ฿</p>
          </div>
        </div>
      </div>

      {/* Revenue by day (last 7) */}
      {revenue?.byDay && revenue.byDay.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-3">📈 รายได้รายวัน (7 วันล่าสุด)</h2>
          <div className="space-y-2">
            {revenue.byDay.slice(-7).reverse().map((d: any) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-24 shrink-0">{d.date.slice(5)}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (d.volume / (revenue.summary.totalVolume / revenue.byDay.length)) * 50)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-20 text-right">{d.volume.toLocaleString()} ฿</span>
                <span className="text-sm text-green-600 w-16 text-right">+{d.fee.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-shop revenue */}
      {revenueByShop && revenueByShop.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-3">🏪 รายได้แยกตามร้าน</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">ร้าน</th>
                  <th className="pb-2 font-medium text-right">รอบ</th>
                  <th className="pb-2 font-medium text-right">ยอดรวม</th>
                  <th className="pb-2 font-medium text-right">รายได้</th>
                </tr>
              </thead>
              <tbody>
                {revenueByShop.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-right text-gray-500">{s.rounds}</td>
                    <td className="py-2 text-right">{s.totalVolume.toLocaleString()} ฿</td>
                    <td className="py-2 text-right text-green-600 font-semibold">{s.fee.toLocaleString()} ฿</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
