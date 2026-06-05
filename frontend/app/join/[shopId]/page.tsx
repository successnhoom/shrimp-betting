'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export default function JoinPage({ params }: { params: { shopId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, _hasHydrated } = useAuthStore()
  const table = searchParams.get('table')

  useEffect(() => {
    if (!_hasHydrated) return
    localStorage.setItem('shopId', params.shopId)
    if (table) localStorage.setItem('tableNumber', table)

    if (!token) {
      router.replace('/')
    } else {
      router.replace(`/bet?shopId=${params.shopId}`)
    }
  }, [_hasHydrated, params.shopId, table, token, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#07080f' }}>
      <div className="text-white text-center space-y-3">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-lg font-bold">กำลังเข้าสู่บ่อ...</p>
      </div>
    </div>
  )
}
