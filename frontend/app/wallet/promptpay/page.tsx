'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { walletApi } from '@/lib/api'
import Link from 'next/link'

const PRESETS = [100, 200, 500, 1000, 2000, 5000]

type QRData = {
  paymentIntentId: string
  amount: number
  qrImageUrl: string | null
  qrData: string | null
  expiresAt: string
}

export default function PromptPayPage() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [qrData, setQrData] = useState<QRData | null>(null)
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const pollRef = useRef<NodeJS.Timeout>()
  const timerRef = useRef<NodeJS.Timeout>()
  const initialBalanceRef = useRef<number | null>(null)

  // Countdown timer
  useEffect(() => {
    if (!qrData) return
    const expiry = new Date(qrData.expiresAt).getTime()
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
      setTimeLeft(left)
      if (left === 0) clearInterval(timerRef.current)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [qrData])

  // Poll wallet balance to detect payment
  useEffect(() => {
    if (!qrData || paid) return

    // Get initial balance first
    walletApi.get().then(r => {
      initialBalanceRef.current = r.data.balance
    })

    pollRef.current = setInterval(async () => {
      try {
        const res = await walletApi.get()
        const newBalance = res.data.balance
        if (initialBalanceRef.current !== null && newBalance > initialBalanceRef.current) {
          clearInterval(pollRef.current)
          setPaid(true)
          toast.success(`🎉 เติมเงิน ${qrData.amount.toLocaleString()} ฿ สำเร็จ!`)
          setTimeout(() => router.push('/wallet'), 2500)
        }
      } catch { /* ignore */ }
    }, 3000)

    return () => clearInterval(pollRef.current)
  }, [qrData, paid, router])

  async function generateQR() {
    const amt = parseFloat(amount)
    if (!amt || amt < 20) return toast.error('ขั้นต่ำ 20 บาท')
    setLoading(true)
    try {
      const res = await walletApi.depositPromptPay(amt)
      setQrData(res.data)
      setTimeLeft(15 * 60)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'เกิดข้อผิดพลาด'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/wallet" className="text-blue-300">← กลับ</Link>
        <h1 className="font-bold">เติมเงิน PromptPay</h1>
      </header>

      <main className="max-w-sm mx-auto p-4 space-y-4">

        {/* Step 1: Enter amount */}
        {!qrData && (
          <div className="card space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">📱</div>
              <p className="font-bold text-gray-800">สแกน QR จ่ายผ่าน PromptPay</p>
              <p className="text-gray-400 text-sm">ชำระผ่านแอปธนาคาร — เครดิตเข้าอัตโนมัติ</p>
            </div>

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
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="input pr-12 text-lg font-bold" placeholder="จำนวนเงิน"
                inputMode="numeric"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
            </div>

            <button onClick={generateQR} disabled={loading || !amount} className="btn-primary w-full text-lg py-4">
              {loading ? '⏳ กำลังสร้าง QR...' : '🔲 สร้าง QR Code'}
            </button>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-600 text-center">
              ✅ เครดิตเข้าอัตโนมัติหลังจ่ายผ่านแอปธนาคาร
            </div>
          </div>
        )}

        {/* Step 2: Show QR */}
        {qrData && !paid && (
          <div className="card space-y-4 text-center">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-800 text-lg">โอน {qrData.amount.toLocaleString()} ฿</p>
              <span className={`text-sm font-mono font-bold px-2 py-1 rounded-lg ${
                timeLeft < 60 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'
              }`}>
                ⏱ {fmt(timeLeft)}
              </span>
            </div>

            {/* QR Image from Stripe */}
            {qrData.qrImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrData.qrImageUrl}
                alt="PromptPay QR"
                className="w-64 mx-auto rounded-2xl border-4 border-gray-100 shadow"
              />
            ) : (
              <div className="w-64 h-64 mx-auto rounded-2xl border-4 border-dashed border-gray-200 flex items-center justify-center">
                <p className="text-gray-400 text-sm">ไม่สามารถแสดง QR ได้</p>
              </div>
            )}

            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-green-700 text-sm font-medium">📋 ขั้นตอน:</p>
              <ol className="text-green-600 text-sm mt-1 space-y-1 text-left list-decimal list-inside">
                <li>เปิดแอปธนาคาร</li>
                <li>เลือก "พร้อมเพย์" หรือ "สแกน QR"</li>
                <li>สแกน QR ด้านบน</li>
                <li>ยืนยันจำนวน {qrData.amount.toLocaleString()} ฿</li>
                <li>เครดิตจะเข้าอัตโนมัติ ✅</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-sm justify-center">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              กำลังรอการชำระเงิน...
            </div>

            <button onClick={() => { setQrData(null); setAmount('') }} className="btn-secondary w-full text-sm">
              ← เปลี่ยนจำนวน
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {paid && (
          <div className="card text-center py-12 space-y-3">
            <div className="text-6xl">🎉</div>
            <p className="font-bold text-gray-800 text-xl">เติมเงินสำเร็จ!</p>
            <p className="text-green-600 font-bold text-2xl">+{qrData?.amount.toLocaleString()} ฿</p>
            <p className="text-gray-400 text-sm">เครดิตเข้ากระเป๋าแล้ว กำลังกลับ...</p>
          </div>
        )}
      </main>
    </div>
  )
}
