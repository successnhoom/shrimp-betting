'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { leaderboardApi, shopApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Skeleton } from '@/components/ui/Skeleton'

const PERIOD_LABELS = { today: 'วันนี้', week: '7 วัน', month: 'เดือนนี้', all: 'ทั้งหมด' }
const RANK_ICONS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const { user } = useAuthStore()
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shopId') || '' : ''
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today')

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', shopId, period],
    queryFn:  () => leaderboardApi.get(shopId || undefined, period).then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/bet" className="text-blue-300">← กลับ</Link>
        <h1 className="font-bold text-lg">🏆 ตารางอันดับ</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {/* Period selector */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key as any)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : !data?.length ? (
          <div className="card text-center py-10 text-gray-400">
            <div className="text-4xl mb-2">🏆</div>
            <p>ยังไม่มีข้อมูลสำหรับช่วงนี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((entry: any) => {
              const isMe = entry.userId === user?.id
              const icon = RANK_ICONS[entry.rank - 1] || `#${entry.rank}`
              return (
                <div key={entry.userId}
                  className={`card flex items-center gap-3 py-3 transition-all ${
                    isMe ? 'border-2 border-blue-400 bg-blue-50' : ''
                  } ${entry.rank <= 3 ? 'shadow-md' : ''}`}>
                  {/* Rank */}
                  <div className="w-10 text-center shrink-0">
                    <span className={`${entry.rank <= 3 ? 'text-2xl' : 'text-base font-bold text-gray-400'}`}>
                      {icon}
                    </span>
                  </div>

                  {/* Avatar + name */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${
                    entry.rank === 1 ? 'bg-yellow-100' :
                    entry.rank === 2 ? 'bg-gray-100' :
                    entry.rank === 3 ? 'bg-orange-100' : 'bg-blue-50'
                  }`}>
                    🦐
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>
                      {entry.displayName} {isMe && <span className="text-xs">(คุณ)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{entry.wonBets} รอบที่ชนะ</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-green-600">{entry.totalPayout.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">฿ รางวัล</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
