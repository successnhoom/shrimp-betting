'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, qrApi } from '@/lib/api'

export default function AdminQR() {
  const [selectedShopId, setSelectedShopId] = useState<string>('')
  const [qrList, setQrList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const { data: shops } = useQuery({
    queryKey: ['adminShops'],
    queryFn: () => adminApi.getShops().then(r => r.data),
  })

  async function loadQRCodes() {
    if (!selectedShopId) return
    setLoading(true)
    try {
      const list = await qrApi.allTables(selectedShopId)
      setQrList(list)
    } finally { setLoading(false) }
  }

  function printAll() {
    window.print()
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📱 QR Code โต๊ะ</h1>
        {qrList.length > 0 && (
          <button onClick={printAll} className="btn-primary text-sm px-4 py-2 print:hidden">
            🖨️ พิมพ์ทั้งหมด
          </button>
        )}
      </div>

      <div className="card flex gap-3 items-end print:hidden">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">เลือกร้าน</label>
          <select value={selectedShopId} onChange={e => setSelectedShopId(e.target.value)} className="input">
            <option value="">-- เลือกร้าน --</option>
            {shops?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} ({s.tableCount} โต๊ะ)</option>
            ))}
          </select>
        </div>
        <button onClick={loadQRCodes} disabled={!selectedShopId || loading}
          className="btn-primary px-5 py-3 shrink-0">
          {loading ? 'กำลังโหลด...' : 'โหลด QR'}
        </button>
      </div>

      {/* QR grid */}
      {qrList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrList.map((t: any) => (
            <div key={t.id} className="card text-center break-inside-avoid">
              <p className="font-bold text-gray-800 mb-2">{t.shopName}</p>
              <p className="text-2xl font-bold text-blue-600 mb-2">โต๊ะ {t.tableNumber}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.dataUrl} alt={`QR โต๊ะ ${t.tableNumber}`} className="w-full max-w-[200px] mx-auto" />
              <p className="text-xs text-gray-400 mt-2 break-all">{t.url}</p>
              <a href={t.url} target="_blank" rel="noopener noreferrer"
                className="mt-2 block text-xs text-blue-500 hover:underline print:hidden">
                ทดสอบลิงก์
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          .print\\:hidden { display: none !important; }
          main { display: block !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
