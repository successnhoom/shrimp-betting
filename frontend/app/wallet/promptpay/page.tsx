'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import Link from 'next/link'

const PRESETS = [100, 200, 500, 1000, 2000, 5000]

export default function PromptPayPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [qrSrc, setQrSrc]         = useState<string | null>(null)
  const [amount, setAmount]         = useState('')
  const [slipFile, setSlipFile]     = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)

  // โหลด QR PromptPay ของร้าน
  useEffect(() => {
    api.get('/deposit/qr')
      .then(r => setQrSrc(`data:image/png;base64,${r.data.qrBase64}`))
      .catch(() => setQrSrc(null))
  }, [])

  function handleSlip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    const reader = new FileReader()
    reader.onload = ev => setSlipPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function submit() {
    const amt = parseFloat(amount)
    if (!amt || amt < 20) return toast.error('ขั้นต่ำ 20 บาท')
    setLoading(true)
    try {
      let slipBase64: string | undefined
      let slipMime: string | undefined
      if (slipFile) {
        const b64 = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = e => res((e.target?.result as string).split(',')[1])
          r.readAsDataURL(slipFile)
        })
        slipBase64 = b64
        slipMime   = slipFile.type
      }
      await api.post('/deposit/request', { amount: amt, slipBase64, slipMime })
      setDone(true)
      toast.success('ส่งคำขอเติมเงินแล้ว รอแอดมินอนุมัติ')
      setTimeout(() => router.push('/wallet'), 3000)
    } catch (err: any) {
      console.error('Deposit error:', err?.response?.status, err?.response?.data)
      const msg = err?.response?.data?.error
        || err?.response?.data?.message
        || (err?.response?.status ? `Error ${err.response.status}` : 'เชื่อมต่อไม่ได้ กรุณาลองใหม่')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card text-center py-12 space-y-3 w-full max-w-sm">
          <div className="text-6xl">✅</div>
          <p className="font-bold text-gray-800 text-xl">ส่งคำขอแล้ว!</p>
          <p className="text-gray-500 text-sm">รอแอดมินอนุมัติ เครดิตจะเข้าหลังอนุมัติ</p>
        </div>
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

        {/* QR Code ของร้าน */}
        <div className="card text-center space-y-3">
          <p className="font-bold text-gray-800">สแกน QR โอนเงิน</p>
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt="PromptPay QR" className="w-56 mx-auto rounded-2xl border-4 border-gray-100 shadow" />
          ) : (
            <div className="w-56 h-56 mx-auto rounded-2xl border-4 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
              ยังไม่มี QR (ติดต่อแอดมิน)
            </div>
          )}
          <p className="text-xs text-gray-400">สแกนจากแอปธนาคาร แล้วกรอกยอดที่ต้องการ</p>
        </div>

        {/* กรอกจำนวน */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-700">จำนวนที่โอน</p>
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
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input pr-10 text-lg font-bold"
              placeholder="จำนวนเงิน (ขั้นต่ำ 20)"
              inputMode="numeric"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
          </div>
        </div>

        {/* แนบสลิป (optional) */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-700">แนบสลิป <span className="text-gray-400 font-normal text-sm">(ไม่บังคับ แต่ช่วยให้อนุมัติเร็วขึ้น)</span></p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSlip} />
          {slipPreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slipPreview} alt="slip" className="w-full rounded-xl object-cover max-h-48" />
              <button onClick={() => { setSlipFile(null); setSlipPreview(null) }}
                className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                ลบ
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all text-sm">
              📸 กดเพื่อแนบสลิป
            </button>
          )}
        </div>

        {/* ส่งคำขอ */}
        <button
          onClick={submit}
          disabled={loading || !amount}
          className="btn-primary w-full text-lg py-4">
          {loading ? '⏳ กำลังส่ง...' : '📨 แจ้งเติมเงิน'}
        </button>

        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700 text-center">
          ⏱ แอดมินจะอนุมัติภายใน 5–15 นาที (ช่วงเวลาทำการ)
        </div>
      </main>
    </div>
  )
}
