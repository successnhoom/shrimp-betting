'use client'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { notifApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export function NotifBell() {
  const { token } = useAuthStore()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => notifApi.unreadCount().then(r => r.data),
    enabled: !!token,
    refetchInterval: 30_000,   // poll every 30s
    staleTime:       15_000,
  })

  const count = data?.count ?? 0

  return (
    <Link href="/notifications">
      <button className="relative text-blue-300 text-xl px-1 py-0.5">
        🔔
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center
            bg-red-500 text-white text-[9px] font-bold rounded-full px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </Link>
  )
}
