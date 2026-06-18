'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { requestPushPermission, isPushSupported, getCurrentPermission } from '@/lib/push'

export function PushButton() {
  const [status, setStatus] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('unsupported')

  useEffect(() => {
    setStatus(getCurrentPermission() as any)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  if (status === 'unsupported' || status === 'granted') return null

  async function enable() {
    const sub = await requestPushPermission()
    if (sub) {
      setStatus('granted')
      toast.success('✅ เปิดการแจ้งเตือนแล้ว')
    } else {
      setStatus('denied')
      toast.error('ไม่ได้รับอนุญาต กรุณาเปิดในการตั้งค่าเบราว์เซอร์')
    }
  }

  if (status === 'denied') return null

  return (
    <button onClick={enable}
      className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl px-4 py-3 text-sm font-medium hover:bg-blue-100 transition-all">
      <span className="text-xl">🔔</span>
      <div className="text-left">
        <p className="font-semibold">เปิดการแจ้งเตือน</p>
        <p className="text-xs text-blue-500">รับแจ้งเมื่อรอบเปิดและชนะรางวัล</p>
      </div>
      <span className="ml-auto text-blue-400">›</span>
    </button>
  )
}
