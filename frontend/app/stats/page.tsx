'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { leaderboardApi, shopApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const MEDAL = ['🥇','🥈','🥉']
const PERIOD_LABELS = {
  today: 'วันนี้',
  week:  '7 วัน',
  month: 'เดือนนี้',
  all:   'ทั้งหมด',
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.max(3, pct)}%` }} />
    </div>
  )
}

export default function StatsPage() {
  const { user } = useAuthStore()
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shopId') || '' : ''
  const [period, setPeriod] = useState<'today'|'week'|'month'|'all'>('today')

  const { data: top, isLoading } = useQuery({
    queryKey: ['stats', shopId, period],
    queryFn:  () => leaderboardApi.get(shopId || undefined, period).then(r => r.data),
    refetchInterval: 30_000,
  })

  const maxWagered = top?.[0]?.totalWagered || 1
  const maxPayout  = top?.[0]?.totalPayout  || 1

  return (
    <div className="min-h-screen bg-gray-950 text-white"
      style={{ fontFamily: "'Sarabun', sans-serif" }}>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/bet" className="text-purple-300 text-sm">← กลับ</Link>
          <div>
            <h1 className="text-2xl font-black">🏆 สถิติผู้แทง</h1>
            <p className="text-purple-300 text-sm">Top 10 อันดับ</p>
          </div>
        </div>
        {user && (
          <div className="bg-white/10 rounded-xl px-4 py-2 text-right">
            <p className="text-xs text-purple-300">คุณ</p>
            <p className="font-bold text-sm">{user.displayName}</p>
          </div>
        )}
      </div>

      {/* Period selector */}
      <div className="flex gap-2 px-4 pt-4">
        {(Object.entries(PERIOD_LABELS) as [string, string][]).map(([k, v]) => (
          <button key={k} onClick={() => setPeriod(k as any)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              period === k
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {v}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 pb-10">
        {isLoading ? (
          <div className="text-center py-16 text-gray-500">กำลังโหลด...</div>
        ) : !top?.length ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-400">ยังไม่มีข้อมูลสำหรับช่วงนี้</p>
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {top.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* 2nd */}
                <div className="flex flex-col items-center pt-6">
                  <div className="text-3xl mb-1">🥈</div>
                  <div className="bg-gray-700 rounded-2xl p-3 text-center w-full">
                    <p className="font-bold text-sm truncate">{top[1].displayName}</p>
                    <p className="text-green-400 font-black">{top[1].totalPayout.toLocaleString()} ฿</p>
                    <p className="text-gray-400 text-xs">{top[1].wonBets} รอบชนะ</p>
                  </div>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center">
                  <div className="text-5xl mb-1 animate-bounce">🥇</div>
                  <div className="bg-gradient-to-b from-yellow-500 to-amber-600 rounded-2xl p-3 text-center w-full shadow-xl">
                    <p className="font-black text-sm truncate text-white">{top[0].displayName}</p>
                    <p className="text-white font-black text-lg">{top[0].totalPayout.toLocaleString()} ฿</p>
                    <p className="text-yellow-200 text-xs">{top[0].wonBets} รอบชนะ</p>
                  </div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center pt-10">
                  <div className="text-2xl mb-1">🥉</div>
                  <div className="bg-gray-800 rounded-2xl p-3 text-center w-full">
                    <p className="font-bold text-sm truncate">{top[2].displayName}</p>
                    <p className="text-green-400 font-black">{top[2].totalPayout.toLocaleString()} ฿</p>
                    <p className="text-gray-400 text-xs">{top[2].wonBets} รอบชนะ</p>
                  </div>
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium">
                <span className="col-span-1">#</span>
                <span className="col-span-4">ชื่อ</span>
                <span className="col-span-4 text-right">รางวัลรวม</span>
                <span className="col-span-3 text-right">ยอดแทง</span>
              </div>
              {top.map((entry: any, i: number) => {
                const isMe = entry.userId === user?.id
                const wageredPct = (entry.totalWagered / maxWagered) * 100
                const payoutPct  = (entry.totalPayout  / maxPayout)  * 100
                return (
                  <div key={entry.userId}
                    className={`px-4 py-3 border-b border-gray-800/50 last:border-0 ${
                      isMe ? 'bg-purple-900/30' : i < 3 ? 'bg-gray-800/50' : ''
                    }`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-1 text-xl">
                        {i < 3 ? MEDAL[i] : <span className="text-gray-500 font-bold text-sm">#{i+1}</span>}
                      </span>
                      <div className="col-span-4">
                        <p className={`font-bold text-sm truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>
                          {entry.displayName}{isMe && ' ★'}
                        </p>
                        <p className="text-gray-500 text-xs">{entry.wonBets} รอบชนะ</p>
                      </div>
                      <div className="col-span-4 text-right">
                        <p className="text-green-400 font-black text-sm">{entry.totalPayout.toLocaleString()} ฿</p>
                        <Bar pct={payoutPct} color="bg-green-500" />
                      </div>
                      <div className="col-span-3 text-right">
                        <p className="text-gray-300 text-sm">{entry.totalWagered.toLocaleString()}</p>
                        <Bar pct={wageredPct} color="bg-blue-500" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 justify-center text-xs text-gray-500 pt-2">
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-green-500 rounded inline-block"/>&nbsp;รางวัลที่ได้รับ</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-blue-500 rounded inline-block"/>&nbsp;ยอดแทงรวม</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
