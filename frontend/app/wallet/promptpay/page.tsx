'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import Link from 'next/link'

const PRESETS = [100, 200, 500, 1000, 2000, 5000]

export default function PromptPayPage() {
  const router = useRouter()
  const [amount, setAmount]       = useState('')
  const [qrImg, setQrImg]         = useState<string | null>(null)   // shop QR (base64)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [slipBase64, setSlipBase64]   = useState<string | null>(null)
  const [slipMime, setSlipMime]       = useState<string>('image/jpeg')
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load shop QR
  useEffect(() => {
    api.get('/deposit/qr').then(r => setQrImg(r.data.qrBase64)).catch(() => {})
  }, [])

  function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('รูปใหญ่เกิน 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      // result = "data:image/jpeg;base64,xxxx"
      const [meta, b64] = result.split(',')
      const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
      setSlipPreview(result)
      setSlipBase64(b64)
      setSlipMime(mime)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt < 20) return toast.error('ขั้นต่ำ 20 บาท')
    setLoading(true)
    try {
      const res = await api.post('/deposit/request', {
        amount: amt,
        slipBase64: slipBase64 || undefined,
        slipMime:   slipBase64 ? slipMime : undefined,
      })
      setRequestId(res.data.requestId)
      setSubmitted(true)
      toast.success('ส่งคำขอแล้ว!')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
          <Link href="/wallet" className="text-blue-300">← กลับ</Link>
          <h1 className="font-bold">เติมเงิน PromptPay</h1>
        </header>
        <main className="max-w-sm mx-auto p-4">
          <div className="card text-center py-12 space-y-4">
            <div className="text-6xl">⏳</div>
            <p className="font-bold text-gray-800 text-xl">รอแอดมินอนุมัติ</p>
            <p className="text-gray-500 text-sm">แจ้งเตือนผ่าน Telegram แล้ว<br/>เครดิตจะเข้าหลังแอดมินกดอนุมัติ</p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-600">
              📋 Request ID: <span className="font-mono">{requestId?.slice(0, 8)}</span>
            </div>
            <button onClick={() => router.push('/wallet')} className="btn-primary w-full">
              กลับหน้ากระเป๋า
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/wallet" className="text-blue-300">← กลับ</Link>
        <h1 className="font-bold">เติมเงิน PromptPay</h1>
      </header>

      <main className="max-w-sm mx-auto p-4 space-y-4">

        {/* Shop QR */}
        <div className="card text-center space-y-3">
          <p className="font-bold text-gray-800">สแกน QR โอนเงิน</p>
          {qrImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${qrImg}`} alt="PromptPay QR"
              className="w-56 mx-auto rounded-2xl border-4 border-gray-100 shadow" />
          ) : (
            <div className="w-56 h-56 mx-auto rounded-2xl border-4 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
              <p className="text-gray-400 text-sm text-center px-4">รอแอดมินอัพโหลด QR Code</p>
            </div>
          )}
          <p className="text-gray-400 text-xs">สแกนด้วยแอปธนาคาร · ทุกธนาคาร</p>
        </div>

        {/* Amount */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-700">ระบุจำนวนเงินที่โอน</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(a => (
              <button key={a} onClick={() => setAmount(a.toString())}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  amount === a.toString()
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:border-blue-400'
                }`}>
                {a.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="relative">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="input pr-12 text-lg font-bold" placeholder="จำนวนเงิน (ขั้นต่ำ 20)"
              inputMode="numeric" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
          </div>
        </div>

        {/* Slip upload */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-700">อัพโหลดสลิป <span className="text-gray-400 text-sm font-normal">(แนะนำ)</span></p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSlipChange} />
          {slipPreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slipPreview} alt="slip" className="w-full rounded-xl border border-gray-200 max-h-48 object-contain" />
              <button onClick={() => { setSlipPreview(null); setSlipBase64(null) }}
                className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                ลบ
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all">
              <div className="text-3xl mb-1">📸</div>
              <p className="text-sm">กดเพื่อเลือกรูปสลิป</p>
            </button>
          )}
        </div>

        <button onClick={handleSubmit} disabled={loading || !amount}
          className="btn-primary w-full text-lg py-4">
          {loading ? '⏳ กำลังส่ง...' : '✅ แจ้งโอนเงินแล้ว'}
        </button>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
          <p className="font-medium mb-1">📋 ขั้นตอน:</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>สแกน QR ด้านบนด้วยแอปธนาคาร</li>
            <li>โอนตามจำนวนที่ระบุ</li>
            <li>ถ่ายรูปสลิปอัพโหลด (ถ้ามี)</li>
            <li>กด "แจ้งโอนเงินแล้ว"</li>
            <li>รอแอดมินอนุมัติ → เครดิตเข้าทันที</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
