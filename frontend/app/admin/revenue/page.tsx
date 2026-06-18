'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import toast from 'react-hot-toast'

export default function AdminRevenue() {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [from, setFrom] = useState(thirtyDaysAgo)
  const [to, setTo] = useState(today)
  const [shopId, setShopId] = useState('')

  const { data: revenue, isLoading, refetch } = useQuery({
    queryKey: ['adminRevenue', from, to, shopId],
    queryFn: () => adminApi.getRevenue(from, to, shopId || undefined).then(r => r.data),
  })

  const { data: shops } = useQuery({
    queryKey: ['adminShops'],
    queryFn: () => adminApi.getShops().then(r => r.data),
  })

  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-2xl font-bold">💰 รายรับ</h1>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จาก</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="input w-40 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ถึง</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="input w-40 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ร้าน</label>
          <select value={shopId} onChange={e => setShopId(e.target.value)} className="input w-44 text-sm">
            <option value="">ทุกร้าน</option>
            {shops?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={() => refetch()} className="btn-primary text-sm px-4 py-2">
          ดูรายงาน
        </button>
        <button
          onClick={async () => {
            try {
              const res = await adminApi.exportCsv(from, to)
              const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
              const a = document.createElement('a'); a.href = url
              a.download = `revenue_${from}_${to}.csv`; a.click()
              URL.revokeObjectURL(url)
            } catch { toast.error('Export ไม่สำเร็จ') }
          }}
          className="btn-secondary text-sm px-4 py-2 border border-green-300 text-green-700">
          📥 Export CSV
        </button>
      </div>

      {/* Summary */}
      {revenue && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon="🎯" label="รอบทั้งหมด" value={revenue.summary.totalRounds} color="blue" />
            <StatCard icon="💵" label="ยอดเงินรวม" value={`${revenue.summary.totalVolume.toLocaleString()} ฿`} color="purple" />
            <StatCard icon="💰" label="รายได้ร้าน (10%)" value={`${revenue.summary.shopFee.toLocaleString()} ฿`} color="green" />
          </div>

          {/* Day-by-day table */}
          {revenue.byDay.length > 0 ? (
            <div className="card overflow-x-auto">
              <h2 className="font-bold text-gray-800 mb-3">รายวัน</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">วันที่</th>
                    <th className="pb-2 font-medium text-right">รอบ</th>
                    <th className="pb-2 font-medium text-right">ยอดรวม</th>
                    <th className="pb-2 font-medium text-right">รายได้</th>
                    <th className="pb-2 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...revenue.byDay].reverse().map((d: any) => (
                    <tr key={d.date} className="border-b border-gray-50">
                      <td className="py-2">{d.date}</td>
                      <td className="py-2 text-right text-gray-500">{d.rounds}</td>
                      <td className="py-2 text-right">{d.volume.toLocaleString()}</td>
                      <td className="py-2 text-right font-semibold text-green-600">{d.fee.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-400">
                        {revenue.summary.totalVolume > 0
                          ? ((d.volume / revenue.summary.totalVolume) * 100).toFixed(1) + '%'
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-bold">
                    <td className="pt-2">รวม</td>
                    <td className="pt-2 text-right">{revenue.summary.totalRounds}</td>
                    <td className="pt-2 text-right">{revenue.summary.totalVolume.toLocaleString()}</td>
                    <td className="pt-2 text-right text-green-600">{revenue.summary.shopFee.toLocaleString()}</td>
                    <td className="pt-2 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="card text-center py-10 text-gray-400">
              ไม่มีข้อมูลในช่วงเวลานี้
            </div>
          )}
        </>
      )}
    </div>
  )
}
