import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ระบบบ่อตกกุ้ง',
    short_name: 'ตกกุ้ง',
    description: 'ระบบเดิมพันตกกุ้งออนไลน์',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e3a8a',
    theme_color: '#1e3a8a',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
