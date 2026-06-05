/**
 * Web Push Notifications
 * ลูกค้ากด "รับการแจ้งเตือน" → ระบบแจ้งเมื่อรอบเปิด / ชนะรางวัล
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function requestPushPermission(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const reg          = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    return subscription
  } catch (err) {
    console.error('Push subscription failed:', err)
    return null
  }
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

export function getCurrentPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/** Show a local notification (no server needed) */
export function showLocalNotification(title: string, body: string, icon = '/icon-192.png') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon })
  }
}
