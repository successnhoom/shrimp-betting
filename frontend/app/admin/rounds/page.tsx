'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi, staffApi } from '@/lib/api'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import dayjs from 'dayjs'

const STATUS_COLOR: Record<string, string> = {
  open:      'bg-green-100 text-green-700',
  locked:    'bg-yellow-100 text-yellow-700',
  settled:   'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function AdminRounds() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ shopId: '', status: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: shops } = useQuery({
    queryKey: ['adminShops'],
    queryFn:  () => adminApi.getShops().then(r => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['adminRounds', filters, page],
    queryFn:  () => {
      const p = new URLSearchParams()
      if (filters.shopId) p.set('shopId', filters.shopId)
      if (filters.status) p.set('status', filters.status)
      if (filters.from)   p.set('from',   filters.from)
      if (filters.to)     p.set('to',     filters.to)
      p.set('page', String(page))
      return import('@/lib/api').then(m => m.api.get(`/admin/rounds?${p}`).then(r => r.data))
    },
    placeholderData: (prev) => prev,
  })

  const { data: stats } = useQuery({
    queryKey: ['adminRoundStats', filters.shopId],
    queryFn:  () => {
      const p = filters.shopId ? `?shopId=${filters.shopId}` : ''
      return import('@/lib/api').then(m => m.api.get(`/admin/rounds/stats${p}`).then(r => r.data))
    },
  })

  const { data: detail } = useQuery({
    queryKey: ['adminRoundDetail', selected?.id],
    queryFn:  () => selected
      ? import('@/lib/api').then(m => m.api.get(`/admin/rounds/${selected.id}`).then(r => r.data))
      : null,
    enabled: !!selected && detailOpen,
  })

  async function voidRound(roundId: string) {
    if (!confirm('⚠️ ยืนยัน Void รอบนี้? เงินจะคืนทั้งหมด')) return
    try {
      await staffApi.voidRound(roundId)
      toast.success('Void รอบแล้ว')
      qc.invalidateQueries({ queryKey: ['adminRounds'] })
      setDetailOpen(false)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Void ไม่สำเร็จ')
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎯 รอบทั้งหมด</h1>
          <p className="text-gray-500 text-sm">ดูและจัดการทุกรอบเดิมพัน</p>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'รอบทั้งหมด',   value: stats.totalRounds,    color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'ยอดรวม',        value: `${stats.totalVolume.toLocaleString()} ฿`, color: 'bg-purple-50 text-purple-700 border-purple-100' },
            { label: 'รายได้',        value: `${stats.totalRevenue.toLocaleString()} ฿`, color: 'bg-green-50 text-green-700 border-green-100' },
            { label: 'เปิดอยู่ตอนนี้', value: stats.activeNow,    color: stats.activeNow > 0 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <p className="text-sm opacity-70">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Even vs Odd win rate */}
      {stats && (
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-600">ผลรอบ: คู่ vs คี่ ({stats.settledRounds} รอบที่ออกผล)</p>
            <div className="flex gap-4 text-sm">
              <span className="text-blue-600 font-bold">🔵 คู่ {stats.evenWins} ({stats.evenWinRate}%)</span>
              <span className="text-amber-500 font-bold">🟡 คี่ {stats.oddWins}</span>
            </div>
          </div>
          {stats.settledRounds > 0 && (
            <div className="h-3 bg-amber-200 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full"
                style={{ width: `${stats.evenWinRate}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">ร้าน</label>
          <select value={filters.shopId}
            onChange={e => { setFilters(f => ({ ...f, shopId: e.target.value })); setPage(1) }}
            className="input text-sm w-36">
            <option value="">ทุกร้าน</option>
            {shops?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">สถานะ</label>
          <select value={filters.status}
            onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}
            className="input text-sm w-32">
            <option value="">ทุกสถานะ</option>
            <option value="open">เปิด</option>
            <option value="locked">ล็อค</option>
            <option value="settled">ออกผลแล้ว</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">จาก</label>
          <input type="date" value={filters.from}
            onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1) }}
            className="input text-sm w-36" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">ถึง</label>
          <input type="date" value={filters.to}
            onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1) }}
            className="input text-sm w-36" />
        </div>
        <button onClick={() => { setFilters({ shopId: '', status: '', from: '', to: '' }); setPage(1) }}
          className="btn-secondary text-sm px-3 py-2">
          รีเซ็ต
        </button>
      </div>

      {/* Rounds table */}
      {isLoading ? <TableSkeleton rows={8} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 text-xs">
                {['รหัสรอบ','ร้าน','พนักงาน','สถานะ','ยอดคู่','ยอดคี่','รวม','ผล','เวลา',''].map(h => (
                  <th key={h} className="pb-2 font-medium pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => { setSelected(r); setDetailOpen(true) }}>
                  <td className="py-2.5 pr-3 font-mono text-xs text-gray-400">#{r.id.slice(-6)}</td>
                  <td className="py-2.5 pr-3 font-medium">{r.shopName}</td>
                  <td className="py-2.5 pr-3 text-gray-500">{r.staffName}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status]}`}>
                      {r.status === 'open' ? '🟢 เปิด' : r.status === 'locked' ? '🟡 ล็อค' :
                       r.status === 'settled' ? '✅ ออกผล' : '❌ ยกเลิก'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-blue-600">{r.totalEven.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-amber-600">{r.totalOdd.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 font-semibold">{r.volume.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-lg">
                    {r.result === 'even' ? '🔵' : r.result === 'odd' ? '🟡' : '–'}
                  </td>
                  <td className="py-2.5 pr-3 text-gray-400 text-xs whitespace-nowrap">
                    {dayjs(r.openedAt).format('DD/MM HH:mm')}
                  </td>
                  <td className="py-2.5">
                    {r.canVoid && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-500 text-xs rounded-full">Void ได้</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-400">รวม {data.total} รอบ</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40">←</button>
                <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data.totalPages}</span>
                <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40">→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Round detail modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)}
        title={`รายละเอียดรอบ #${selected?.id?.slice(-6)}`}>
        {!detail ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'ร้าน',      value: detail.shopName },
                { label: 'พนักงาน',   value: detail.staffName },
                { label: 'เปิดเวลา',  value: dayjs(detail.openedAt).format('DD/MM/YY HH:mm') },
                { label: 'ออกผลเวลา', value: detail.settledAt ? dayjs(detail.settledAt).format('DD/MM/YY HH:mm') : '–' },
              ].map(i => (
                <div key={i.label} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-gray-400 text-xs">{i.label}</p>
                  <p className="font-medium mt-0.5">{i.value}</p>
                </div>
              ))}
            </div>

            {/* Volume */}
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between mb-2 text-sm font-medium">
                <span className="text-blue-600">🔵 คู่ {detail.totalEven.toLocaleString()} ฿ ({detail.summary.evenBets} ใบ)</span>
                <span className="text-amber-500">🟡 คี่ {detail.totalOdd.toLocaleString()} ฿ ({detail.summary.oddBets} ใบ)</span>
              </div>
              {detail.totalVolume > 0 && (
                <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${(detail.totalEven / detail.totalVolume) * 100}%` }} />
                </div>
              )}
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>ยอดรวม {detail.totalVolume.toLocaleString()} ฿</span>
                <span className="text-green-600 font-medium">รายได้ร้าน {detail.shopFee.toFixed(0)} ฿</span>
              </div>
            </div>

            {/* Result + stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {[
                { label: 'ชนะ',     value: detail.summary.winners,  color: 'text-green-600' },
                { label: 'แพ้',      value: detail.summary.losers,   color: 'text-red-500'   },
                { label: 'คืนเงิน', value: detail.summary.refunded, color: 'text-gray-500'  },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-2">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Bet list */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">รายการแทง ({detail.bets.length} รายการ)</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {detail.bets.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-xl text-sm">
                    <div className="flex items-center gap-2">
                      <span>{b.side === 'even' ? '🔵' : '🟡'}</span>
                      <span className="font-medium">{b.user.displayName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>{b.amountAccepted.toLocaleString()} ฿</span>
                      {b.payout != null && (
                        <span className={b.payout > 0 ? 'text-green-600 font-bold' : 'text-gray-400'}>
                          {b.payout > 0 ? `+${b.payout.toLocaleString()}` : '–'}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        b.status === 'won' ? 'bg-green-100 text-green-600' :
                        b.status === 'lost' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'
                      }`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Void button */}
            {detail.canVoid && (
              <button onClick={() => voidRound(detail.id)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all">
                ⚠️ Void รอบนี้ (คืนเงินทั้งหมด)
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
