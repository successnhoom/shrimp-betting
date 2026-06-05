'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { walletApi } from '@/lib/api'
import Link from 'next/link'

const PRESETS = [100, 200, 500, 1000, 2000, 5000]

export default function PromptPayPage() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [qrData, setQrData] = useState<{ qrDataUrl: string; amount: number; phone: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function generateQR() {
    const amt = parseFloat(amount)
    if (!amt || amt < 20) return toast.error('ขั้นต่ำ 20 บาท')
    setLoading(true)
    try {
      const res = await walletApi.depositPromptPay(amt)
      setQrData(res.data)
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  function handleConfirmed() {
    setConfirmed(true)
    toast.success('แจ้งโอนเงินแล้ว รอพนักงานยืนยัน')
    setTimeout(() => router.push('/wallet'), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/wallet" className="text-blue-300">← กลับ</Link>
        <h1 className="font-bold">เติมเงิน PromptPay</h1>
      </header>

      <main className="max-w-sm mx-auto p-4 space-y-4">
        {!qrData ? (
          <div className="card space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">📱</div>
              <p className="font-bold text-gray-800">สแกน QR จ่ายผ่าน PromptPay</p>
              <p className="text-gray-400 text-sm">ชำระผ่านแอปธนาคารได้เลย</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map(a => (
                <button key={a} onClick={() => setAmount(a.toString())}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                    amount === a.toString() ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}>
                  {a.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="input pr-12 text-lg font-bold" placeholder="จำนวนเงิน" inputMode="numeric" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
            </div>

            <button onClick={generateQR} disabled={loading || !amount} className="btn-primary w-full">
              {loading ? '⏳ กำลังสร้าง QR...' : '🔲 สร้าง QR Code'}
            </button>
          </div>
        ) : !confirmed ? (
          <div className="card space-y-4 text-center">
            <p className="font-bold text-gray-800 text-lg">สแกนเพื่อโอน {qrData.amount.toLocaleString()} ฿</p>
            <p className="text-gray-500 text-sm">PromptPay: {qrData.phone}</p>

            {/* QR Code image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData.qrDataUrl} alt="PromptPay QR" className="w-64 mx-auto rounded-2xl border-4 border-gray-100" />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
              <p className="text-amber-700 text-sm font-medium">📋 ขั้นตอน:</p>
              <ol className="text-amber-600 text-sm mt-1 space-y-1 list-decimal list-inside">
                <li>เปิดแอปธนาคาร</li>
                <li>เลือก "พร้อมเพย์" หรือ "สแกน QR"</li>
                <li>สแกน QR ด้านบน</li>
                <li>ยืนยันจำนวน {qrData.amount.toLocaleString()} ฿</li>
                <li>กด "แจ้งโอนแล้ว" ด้านล่าง</li>
              </ol>
            </div>

            <button onClick={handleConfirmed} className="btn-primary w-full">
              ✅ แจ้งโอนเงินแล้ว
            </button>
            <button onClick={() => setQrData(null)} className="btn-secondary w-full text-sm">
              ← เปลี่ยนจำนวน
            </button>
          </div>
        ) : (
          <div className="card text-center py-10">
            <div className="text-5xl mb-3">⏳</div>
            <p className="font-bold text-gray-800">รอพนักงานยืนยัน</p>
            <p className="text-gray-400 text-sm mt-1">เครดิตจะเข้าทันทีหลังพนักงานยืนยัน</p>
          </div>
        )}
      </main>
    </div>
  )
}
