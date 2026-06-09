'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import dayjs from 'dayjs'
import 'dayjs/locale/th'

export default function AdminDepositsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [qrBase64, setQrBase64]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab]             = useState<'pending' | 'approved' | 'rejected'>('pending')

  // Load current QR
  useEffect(() => {
    api.get('/deposit/qr')
      .then(r => setQrPreview(`data:image/png;base64,${r.data.qrBase64}`))
      .catch(() => {})
  }, [])

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['deposit-requests', tab],
    queryFn:  () => api.get(`/deposit/requests?status=${tab}`).then(r => r.data),
    refetchInterval: tab === 'pending' ? 5000 : false,
  })

  function handleQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const b64    = result.split(',')[1]
      setQrPreview(result)
      setQrBase64(b64)
    }
    reader.readAsDataURL(file)
  }

  async function uploadQR() {
    if (!qrBase64) return
    setUploading(true)
    try {
      await api.post('/deposit/qr', { qrBase64 })
      toast.success('อัพโหลด QR สำเร็จ!')
    } catch {
      toast.error('อัพโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/deposit/approve/${id}`, {}),
    onSuccess: (_, id) => {
      toast.success('อนุมัติแล้ว ✅')
      qc.invalidateQueries({ queryKey: ['deposit-requests'] })
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/deposit/reject/${id}`, {}),
    onSuccess: () => {
      toast.success('ปฏิเสธแล้ว')
      qc.invalidateQueries({ queryKey: ['deposit-requests'] })
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  async function setupTelegram() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''
      if (!baseUrl) { toast.error('ไม่พบ API URL'); return }
      const res = await api.post('/deposit/setup-telegram', {
        baseUrl: baseUrl.replace('/api', '')
      })
      if (res.data.ok) toast.success('ตั้ง Telegram Webhook สำเร็จ!')
      else toast.error(JSON.stringify(res.data))
    } catch { toast.error('ไม่สำเร็จ') }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">💰 จัดการการเติมเงิน</h1>

      {/* QR Upload section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-4">📱 QR Code PromptPay ของร้าน</h2>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex-shrink-0 text-center">
            {qrPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrPreview} alt="QR" className="w-48 h-48 rounded-xl border-4 border-gray-100 object-contain" />
            ) : (
              <div className="w-48 h-48 rounded-xl border-4 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm text-center">
                ยังไม่มี QR
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-gray-600 text-sm">อัพโหลดรูป QR PromptPay ของคุณ ลูกค้าจะเห็นรูปนี้เพื่อสแกนโอนเงิน</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleQrFile} />
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all text-sm w-full sm:w-auto">
              📁 เลือกรูป QR
            </button>
            {qrBase64 && (
              <button onClick={uploadQR} disabled={uploading}
                className="btn-primary w-full sm:w-auto ml-0 sm:ml-2">
                {uploading ? '⏳ กำลังอัพโหลด...' : '✅ บันทึก QR'}
              </button>
            )}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">ตั้ง Telegram Webhook (ทำครั้งแรกครั้งเดียว)</p>
              <button onClick={setupTelegram}
                className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg hover:bg-blue-100">
                🤖 ตั้งค่า Telegram Bot
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit requests */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            {(['pending', 'approved', 'rejected'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {t === 'pending' ? '⏳ รออนุมัติ' : t === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธ'}
                {tab === t && requests.length > 0 && (
                  <span className="ml-1.5 bg-white/30 text-xs px-1.5 rounded-full">{requests.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {tab === 'pending' ? 'ไม่มีรายการรออนุมัติ' : 'ไม่มีรายการ'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req: any) => (
              <div key={req.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800">{Number(req.amount).toLocaleString()} ฿</span>
                    <span className="text-xs text-gray-500">{req.user?.displayName} · {req.user?.phone}</span>
                    {req.hasSlip && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">📸 มีสลิป</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{dayjs(req.createdAt).format('DD/MM/YY HH:mm')}</p>
                </div>
                {tab === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => approveMut.mutate(req.id)}
                      disabled={approveMut.isPending}
                      className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-xl font-medium hover:bg-green-600 active:scale-95 transition-all">
                      ✅ อนุมัติ
                    </button>
                    <button
                      onClick={() => rejectMut.mutate(req.id)}
                      disabled={rejectMut.isPending}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-xl font-medium hover:bg-red-100 hover:text-red-600 active:scale-95 transition-all">
                      ❌
                    </button>
                  </div>
                )}
                {tab !== 'pending' && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    tab === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {tab === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธ'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
