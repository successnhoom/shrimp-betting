'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { notifApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'

const TABS = [
  { href: '/bet',          icon: '🎯', label: 'แทง' },
  { href: '/leaderboard',  icon: '🏆', label: 'อันดับ' },
  { href: '/wallet',       icon: '💳', label: 'กระเป๋า' },
  { href: '/notifications',icon: '🔔', label: 'แจ้งเตือน' },
  { href: '/profile',      icon: '👤', label: 'โปรไฟล์' },
]

export function CustomerNav() {
  const pathname = usePathname()
  const { token } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn:  () => notifApi.unreadCount().then(r => r.data),
    enabled:  !!token,
    refetchInterval: 30_000,
  })
  const unread = data?.count ?? 0

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe"
      style={{
        background: 'linear-gradient(0deg, rgba(10,14,26,0.98) 0%, rgba(13,27,62,0.96) 100%)',
        borderTop: '1px solid rgba(79,159,255,0.12)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
      <div className="flex justify-around px-1 pt-2 pb-2 max-w-lg mx-auto">
        {TABS.map(t => {
          const active = pathname.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href}
              className={clsx('flex flex-col items-center py-1 px-3 rounded-xl transition-all relative',
                active ? 'text-blue-400' : 'text-white/30')}>
              <div className="relative">
                <span className={clsx('text-2xl transition-transform', active ? 'scale-110' : 'scale-100')}>
                  {t.icon}
                </span>
                {t.href === '/notifications' && unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center
                    rounded-full text-[8px] font-black text-white"
                    style={{ background: '#ef4444', padding: '0 2px', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span className={clsx('text-[9px] mt-0.5 font-semibold tracking-wide',
                active ? 'text-blue-400' : 'text-white/25')}>
                {t.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-400"
                  style={{ boxShadow: '0 0 8px rgba(96,165,250,0.8)' }} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
