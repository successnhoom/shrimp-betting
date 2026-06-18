'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Link from 'next/link'
import dayjs from 'dayjs'
import { profileApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Skeleton } from '@/components/ui/Skeleton'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  won:      { label: 'ชนะ',      color: 'text-green-600 bg-green-50' },
  lost:     { label: 'แพ้',      color: 'text-red-500 bg-red-50' },
  refunded: { label: 'คืนเงิน',  color: 'text-gray-500 bg-gray-100' },
  accepted: { label: 'รอผล',     color: 'text-blue-600 bg-blue-50' },
  partial:  { label: 'บางส่วน',  color: 'text-amber-600 bg-amber-50' },
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const [editName, setEditName] = useState(false)
  const [newName, setNewName] = useState(user?.displayName || '')
  const [tab, setTab] = useState<'stats' | 'history'>('stats')
  const [betPage, setBetPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSide, setFilterSide] = useState('')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['profileStats'],
    queryFn: () => profileApi.stats().then(r => r.data),
  })

  const { data: betsData, isLoading: betsLoading } = useQuery({
    queryKey: ['profileBets', betPage, filterStatus, filterSide],
    queryFn: () => profileApi.bets(betPage, filterStatus || undefined, filterSide as any || undefined).then(r => r.data),
    enabled: tab === 'history',
  })

  async function saveName() {
    if (!newName.trim()) return
    try {
      const res = await profileApi.updateName(newName.trim())
      setUser({ ...user!, displayName: res.data.displayName })
      toast.success('เปลี่ยนชื่อแล้ว')
      setEditName(false)
    } catch { toast.error('ไม่สำเร็จ') }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/bet" className="text-blue-300">← กลับ</Link>
        <h1 className="font-bold text-lg">โปรไฟล์</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {/* Profile card */}
        <div className="card text-center pt-6 pb-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl mx-auto mb-3">
            🦐
          </div>
          {editName ? (
            <div className="flex gap-2 justify-center">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="input text-center max-w-[200px]" autoFocus
                onKeyDown={e => e.key === 'Enter' && saveName()} />
              <button onClick={saveName} className="btn-primary px-4 py-2 text-sm">บันทึก</button>
              <button onClick={() => setEditName(false)} className="btn-secondary px-4 py-2 text-sm">ยกเลิก</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold">{user?.displayName}</h2>
              <button onClick={() => { setNewName(user?.displayName || ''); setEditName(true) }}
                className="text-gray-400 hover:text-gray-600 text-lg">✏️</button>
            </div>
          )}
          <p className="text-gray-400 text-sm mt-1">{user?.phone}</p>

          {stats && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2">
              <div>
                <p className="text-xl font-bold text-blue-600">{stats.balance.toLocaleString()}</p>
                <p className="text-xs text-gray-400">เครดิต ฿</p>
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalBets}</p>
                <p className="text-xs text-gray-400">รอบที่แทง</p>
              </div>
              <div>
                <p className={`text-xl font-bold ${stats.winRate >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                  {stats.winRate}%
                </p>
                <p className="text-xs text-gray-400">อัตราชนะ</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
          {(['stats', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
              }`}>
              {t === 'stats' ? '📊 สถิติ' : '📋 ประวัติการแทง'}
            </button>
          ))}
        </div>

        {/* Stats tab */}
        {tab === 'stats' && (
          statsLoading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              {/* Win/Loss */}
              <div className="card">
                <h3 className="font-bold text-gray-700 mb-3">ผลการเล่น</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '✅ ชนะ', value: stats.wonBets, color: 'text-green-600' },
                    { label: '❌ แพ้',  value: stats.lostBets, color: 'text-red-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {/* Win bar */}
                <div className="mt-3 h-3 bg-red-100 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full rounded-full transition-all"
                    style={{ width: `${stats.winRate}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>ชนะ {stats.winRate}%</span>
                  <span>แพ้ {(100 - stats.winRate).toFixed(1)}%</span>
                </div>
              </div>

              {/* Money */}
              <div className="card">
                <h3 className="font-bold text-gray-700 mb-3">เงิน</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'รวมยอดแทง',  value: stats.totalWagered,  color: '' },
                    { label: 'รวมรางวัล',  value: stats.totalPayout,   color: 'text-green-600' },
                    { label: 'กำไร/ขาดทุน', value: stats.netProfit,    color: stats.netProfit >= 0 ? 'text-green-600' : 'text-red-500' },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500">{s.label}</span>
                      <span className={`font-bold ${s.color}`}>
                        {s.value >= 0 ? '+' : ''}{s.value.toLocaleString()} ฿
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Streak & Side */}
              <div className="card">
                <h3 className="font-bold text-gray-700 mb-3">แนวโน้ม</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400">Streak ปัจจุบัน</p>
                    <p className={`text-2xl font-bold mt-1 ${stats.streakType === 'win' ? 'text-green-600' : 'text-red-500'}`}>
                      {stats.currentStreak > 0 ? `${stats.streakType === 'win' ? '🔥' : '💧'} ${stats.currentStreak}` : '–'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400">ฝั่งที่ชอบ</p>
                    <p className="text-2xl mt-1">
                      {stats.favouriteSide === 'even' ? '🔵 คู่' : '🟡 คี่'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2">
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setBetPage(1) }}
                className="input flex-1 text-sm py-2">
                <option value="">ทุกสถานะ</option>
                <option value="won">ชนะ</option>
                <option value="lost">แพ้</option>
                <option value="refunded">คืนเงิน</option>
              </select>
              <select value={filterSide} onChange={e => { setFilterSide(e.target.value); setBetPage(1) }}
                className="input flex-1 text-sm py-2">
                <option value="">ทุกฝั่ง</option>
                <option value="even">คู่</option>
                <option value="odd">คี่</option>
              </select>
            </div>

            {betsLoading ? (
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            ) : betsData?.data?.length === 0 ? (
              <div className="card text-center py-8 text-gray-400">ไม่มีรายการ</div>
            ) : (
              <>
                <div className="space-y-2">
                  {betsData?.data?.map((bet: any) => {
                    const st = STATUS_LABEL[bet.status] || { label: bet.status, color: 'text-gray-500 bg-gray-100' }
                    return (
                      <div key={bet.id} className={`card flex items-center gap-3 py-3 ${
                        bet.status === 'won' ? 'border-green-200' : bet.status === 'lost' ? 'border-red-100' : ''
                      }`}>
                        <span className="text-2xl">{bet.side === 'even' ? '🔵' : '🟡'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{bet.side === 'even' ? 'คู่' : 'คี่'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {bet.round.shopName} · {dayjs(bet.createdAt).format('DD/MM HH:mm')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{bet.amountAccepted.toLocaleString()} ฿</p>
                          {bet.payout != null && (
                            <p className={`text-xs font-semibold ${bet.payout > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {bet.payout > 0 ? `+${bet.payout.toLocaleString()}` : '–'} ฿
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Pagination */}
                {betsData?.totalPages > 1 && (
                  <div className="flex justify-center gap-3">
                    <button disabled={betPage === 1} onClick={() => setBetPage(p => p - 1)}
                      className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">←</button>
                    <span className="py-2 text-sm text-gray-600">{betPage} / {betsData.totalPages}</span>
                    <button disabled={betPage === betsData.totalPages} onClick={() => setBetPage(p => p + 1)}
                      className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">→</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
