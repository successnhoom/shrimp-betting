'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/th'
import toast from 'react-hot-toast'
import { notifApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Skeleton } from '@/components/ui/Skeleton'

dayjs.extend(relativeTime)
dayjs.locale('th')

const TYPE_ICON: Record<string, string> = {
  round_opened:     '🎯',
  win:              '🎉',
  lose:             '😔',
  deposit:          '💳',
  withdraw_approved:'✅',
  refund:           '↩️',
  system:           '📢',
}

const TYPE_BG: Record<string, string> = {
  win:   'bg-green-50 border-green-100',
  lose:  'bg-red-50 border-red-100',
  round_opened: 'bg-blue-50 border-blue-100',
  deposit: 'bg-emerald-50 border-emerald-100',
  withdraw_approved: 'bg-emerald-50 border-emerald-100',
  refund: 'bg-amber-50 border-amber-100',
  system: 'bg-gray-50 border-gray-100',
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const { token } = useAuthStore()
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn: () => notifApi.list(page, unreadOnly).then(r => r.data),
    enabled: !!token,
  })

  async function markRead(id: string) {
    await notifApi.markRead(id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['unreadCount'] })
  }

  async function markAll() {
    await notifApi.markAll()
    toast.success('อ่านทั้งหมดแล้ว')
    refetch()
    qc.invalidateQueries({ queryKey: ['unreadCount'] })
  }

  async function clearRead() {
    const res = await notifApi.clearRead()
    toast.success(`ลบ ${res.data.deleted} รายการแล้ว`)
    refetch()
  }

  async function deleteOne(id: string) {
    await notifApi.delete(id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/bet" className="text-blue-300 text-sm">← กลับ</Link>
            <h1 className="font-bold text-lg">🔔 การแจ้งเตือน</h1>
          </div>
          {(data?.unreadCount ?? 0) > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {data?.unreadCount} ใหม่
            </span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-3 pb-10">
        {/* Actions bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex bg-white rounded-xl border border-gray-200 p-0.5">
            <button onClick={() => { setUnreadOnly(false); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!unreadOnly ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>
              ทั้งหมด
            </button>
            <button onClick={() => { setUnreadOnly(true); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${unreadOnly ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>
              ยังไม่อ่าน {data?.unreadCount ? `(${data.unreadCount})` : ''}
            </button>
          </div>
          <div className="flex gap-2">
            {(data?.unreadCount ?? 0) > 0 && (
              <button onClick={markAll} className="text-xs px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100">
                อ่านทั้งหมด
              </button>
            )}
            <button onClick={clearRead} className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200">
              ลบที่อ่านแล้ว
            </button>
          </div>
        </div>

        {/* Notification list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-3">🔕</div>
            <p className="font-medium text-gray-600">ไม่มีการแจ้งเตือน</p>
            <p className="text-gray-400 text-sm mt-1">
              {unreadOnly ? 'อ่านครบหมดแล้ว!' : 'เริ่มเล่นเพื่อรับการแจ้งเตือน'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {data.data.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`card flex items-start gap-3 cursor-pointer transition-all border ${
                    TYPE_BG[n.type] ?? 'bg-white border-gray-100'
                  } ${!n.isRead ? 'shadow-sm' : 'opacity-75'}`}
                >
                  {/* Icon */}
                  <div className="text-2xl shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] ?? '📬'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold text-sm leading-tight ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-gray-400 text-xs mt-1">{dayjs(n.createdAt).fromNow()}</p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                    className="text-gray-300 hover:text-gray-500 shrink-0 text-lg leading-none mt-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex justify-center gap-3 pt-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">←</button>
                <span className="py-2 text-sm text-gray-500">{page} / {data.totalPages}</span>
                <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">→</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
