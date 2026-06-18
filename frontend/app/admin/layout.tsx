'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { AdminNav } from '@/components/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { token, user, _hasHydrated } = useAuthStore()

  useEffect(() => {
    if (!_hasHydrated) return           // รอ localStorage โหลดก่อน
    if (!token || user?.role !== 'admin') router.replace('/')
  }, [_hasHydrated, token, user])

  // ยังไม่ hydrate = แสดง spinner แทน null ไม่ให้หน้าขาว
  if (!_hasHydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#07080f' }}>
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/30 text-sm">กำลังโหลด...</p>
      </div>
    </div>
  )

  if (!token || user?.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="lg:ml-60 p-4 lg:p-6 pb-28 lg:pb-8">
        {children}
      </main>
    </div>
  )
}
