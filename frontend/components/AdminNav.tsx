'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Logo } from '@/components/Logo'

const NAV = [
  { href: '/admin',              label: 'Dashboard',  icon: '📊', group: 'main' },
  { href: '/staff',              label: 'ควบคุมรอบ',  icon: '🎮', group: 'main' },
  { href: '/admin/analytics',    label: 'Analytics',  icon: '📈', group: 'main' },
  { href: '/admin/rounds',       label: 'รอบทั้งหมด', icon: '🎯', group: 'main' },
  { href: '/admin/shops',        label: 'ร้านค้า',    icon: '🏪', group: 'manage' },
  { href: '/admin/staff',        label: 'พนักงาน',    icon: '👷', group: 'manage' },
  { href: '/admin/users',        label: 'สมาชิก',     icon: '👥', group: 'manage' },
  { href: '/admin/deposits',     label: 'เติมเงิน',   icon: '💳', group: 'finance', depositBadge: true },
  { href: '/admin/revenue',      label: 'รายรับ',     icon: '💰', group: 'finance' },
  { href: '/admin/withdrawals',  label: 'ถอนเงิน',    icon: '💸', group: 'finance', badge: true },
  { href: '/admin/qr',           label: 'QR Code',    icon: '📱', group: 'tools' },
  { href: '/display',            label: 'จอในร้าน',   icon: '🖥️', group: 'tools' },
  { href: '/stats',              label: 'สถิติ',      icon: '🏆', group: 'tools' },
]

const GROUPS: Record<string, string> = {
  main:    'ภาพรวม',
  manage:  'จัดการ',
  finance: 'การเงิน',
  tools:   'เครื่องมือ',
}

const BOTTOM_NAV = ['/admin', '/admin/deposits', '/admin/rounds', '/admin/revenue', '/admin/withdrawals']

export function AdminNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { logout, user } = useAuthStore()

  const { data: withdrawalData } = useQuery({
    queryKey: ['adminWithdrawals'],
    queryFn:  () => adminApi.getWithdrawals().then(r => r.data),
    refetchInterval: 30_000,
  })
  const pendingCount = withdrawalData?.length ?? 0

  const { data: depositData } = useQuery({
    queryKey: ['adminDeposits', 'pending'],
    queryFn:  () => import('@/lib/api').then(m => m.api.get('/deposit/requests?status=pending').then(r => r.data)),
    refetchInterval: 15_000,
  })
  const pendingDepositCount = depositData?.length ?? 0

  const grouped = Object.entries(GROUPS).map(([key, label]) => ({
    key, label, items: NAV.filter(n => n.group === key),
  }))

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 z-30 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0a0e1a 0%, #0f1729 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>

        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Logo size={40} />
            </div>
            <div>
              <p className="font-black text-white text-base tracking-wide">บ่อตกกุ้ง 89</p>
              <p className="text-[10px] text-blue-400 uppercase tracking-widest">Admin Panel</p>
            </div>
          </div>
          {user && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-white/5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">{user.displayName}</p>
                <p className="text-blue-400 text-[10px]">{user.role}</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav groups — scrollable */}
        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto min-h-0">
          {grouped.map(g => (
            <div key={g.key}>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3 mb-1.5">
                {g.label}
              </p>
              <div className="space-y-0.5">
                {g.items.map(n => {
                  const active = pathname === n.href
                  return (
                    <Link key={n.href} href={n.href}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                        active
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      )}>
                      <span className="text-base">{n.icon}</span>
                      <span>{n.label}</span>
                      <span className="ml-auto flex items-center gap-1">
                        {(n as any).badge && pendingCount > 0 && (
                          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black animate-pulse"
                            style={{ background:'#ef4444', color:'white', boxShadow:'0 0 8px rgba(239,68,68,0.5)', padding:'0 4px' }}>
                            {pendingCount}
                          </span>
                        )}
                        {(n as any).depositBadge && pendingDepositCount > 0 && (
                          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black animate-pulse"
                            style={{ background:'#f59e0b', color:'white', boxShadow:'0 0 8px rgba(245,158,11,0.5)', padding:'0 4px' }}>
                            {pendingDepositCount}
                          </span>
                        )}
                        {active && !((n as any).badge && pendingCount > 0) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout — sticky bottom */}
        <div className="shrink-0 p-3 border-t border-white/5">
          <button onClick={() => { logout(); router.push('/') }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ color:'rgba(255,255,255,0.4)', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.18)'; (e.currentTarget as HTMLElement).style.color='white' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.07)'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)' }}>
            <span>🚪</span> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pb-2"
        style={{ background: 'linear-gradient(0deg, rgba(10,14,26,0.98) 0%, rgba(10,14,26,0.95) 100%)' }}>
        <div className="flex justify-around bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
          {NAV.filter(n => BOTTOM_NAV.includes(n.href)).map(n => {
            const active = pathname === n.href
            return (
              <Link key={n.href} href={n.href}
                className={clsx('flex flex-col items-center py-2.5 px-3 text-[10px] font-semibold transition-all',
                  active ? 'text-blue-400' : 'text-white/30')}>
                <span className="text-lg mb-0.5">{n.icon}</span>
                {n.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile more menu */}
      <div className="lg:hidden fixed top-3 right-3 z-50">
        <details className="relative">
          <summary className="list-none cursor-pointer glass-dark px-3 py-2 text-sm font-semibold text-white">
            ⋯ เมนู
          </summary>
          <div className="absolute right-0 top-10 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 w-44">
            {NAV.filter(n => !BOTTOM_NAV.includes(n.href)).map(n => (
              <Link key={n.href} href={n.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5">
                <span>{n.icon}</span>{n.label}
              </Link>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button onClick={() => { logout(); router.push('/') }}
                className="w-full text-left px-3 py-2 text-sm text-white/30 hover:text-white rounded-xl hover:bg-white/5">
                ← ออกจากระบบ
              </button>
            </div>
          </div>
        </details>
      </div>
    </>
  )
}
