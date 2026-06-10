'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api, walletApi } from '@/lib/api'
import Link from 'next/link'

const PRESETS = [100, 200, 500, 1000, 2000, 5000]

type PayinPool = {
  bankCode:      string
  bankName:      string
  accountName:   string
  accountNumber: string
}

type QRData = {
  orderId:       string
  paymentType:   string          // 'qr' | 'transfer'
  qrCode:        string | null   // QR provider
  paymentUrl:    string | null   // QR provider
  pool:          PayinPool | null // Transfer provider
  amount:        number
  expiredAt:     string
  expiryMinutes: number
}

export default function PromptPayPage() {
  const router = useRouter()
  const [amount, setAmount]             = useState('')
  const [qrData, setQrData]             = useState<QRData | null>(null)
  const [paid, setPaid]                 = useState(false)
  const [loading, setLoading]           = useState(false)
  const [timeLeft, setTimeLeft]         = useState(0)
  const pollRef                         = useRef<NodeJS.Timeout>()
  const timerRef                        = useRef<NodeJS.Timeout>()
  const initialBalanceRef               = useRef<number | null>(null)

  // Countdown
  useEffect(() => {
    if (!qrData) return
    const expiry = new Date(qrData.expiredAt).getTime()
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
      setTimeLeft(left)
      if (left === 0) clearInterval(timerRef.current)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [qrData])

  // Poll wallet balance — detect auto-credit จาก webhook
  useEffect(() => {
    if (!qrData || paid) return
    walletApi.get().then(r => { initialBalanceRef.current = r.data.balance })

    pollRef.current = setInterval(async () => {
      try {
        const res = await walletApi.get()
        if (initialBalanceRef.current !== null && res.data.balance > initialBalanceRef.current) {
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
      const res = await api.post('/deposit/create', { amount: amt })
      setQrData(res.data)
      setTimeLeft((res.data.expiryMinutes || 15) * 60)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'เกิดข้อผิดพลาด'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (paid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card text-center py-12 space-y-3 w-full max-w-sm">
          <div className="text-6xl">🎉</div>
          <p className="font-bold text-gray-800 text-xl">เติมเงินสำเร็จ!</p>
          <p className="text-green-600 font-bold text-2xl">+{qrData?.amount.toLocaleString()} ฿</p>
          <p className="text-gray-400 text-sm">เครดิตเข้ากระเป๋าแล้ว</p>
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

        {/* Step 1: Enter amount */}
        {!qrData && (
          <div className="card space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">📱</div>
              <p className="font-bold text-gray-800">สแกน QR จ่ายผ่าน PromptPay</p>
              <p className="text-gray-400 text-sm">เครดิตเข้าอัตโนมัติทันทีที่จ่าย</p>
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
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="input pr-12 text-lg font-bold" placeholder="จำนวนเงิน (ขั้นต่ำ 20)"
                inputMode="numeric" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
            </div>

            <button onClick={generateQR} disabled={loading || !amount}
              className="btn-primary w-full text-lg py-4">
              {loading ? '⏳ กำลังสร้าง QR...' : '🔲 สร้าง QR Code'}
            </button>

            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700 text-center">
              ✅ เครดิตเข้าอัตโนมัติ ไม่ต้องรอแอดมิน
            </div>
          </div>
        )}

        {/* Step 2: Show payment info */}
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

            {/* QR Provider */}
            {qrData.paymentType !== 'transfer' && (
              <>
                {qrData.qrCode ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrData.qrCode}
                    alt="PromptPay QR"
                    className="w-64 mx-auto rounded-2xl border-4 border-gray-100 shadow"
                  />
                ) : qrData.paymentUrl ? (
                  <div className="space-y-2">
                    <div className="w-64 h-64 mx-auto rounded-2xl border-4 border-dashed border-blue-200 flex flex-col items-center justify-center gap-2">
                      <p className="text-4xl">🔗</p>
                      <p className="text-gray-500 text-sm px-4">กดลิ้งก์ด้านล่างเพื่อชำระ</p>
                    </div>
                    <a href={qrData.paymentUrl} target="_blank" rel="noreferrer"
                      className="btn-primary w-full block text-center">
                      🔗 เปิดหน้าชำระเงิน
                    </a>
                  </div>
                ) : (
                  <div className="w-64 h-64 mx-auto rounded-2xl border-4 border-dashed border-gray-200 flex items-center justify-center">
                    <p className="text-gray-400 text-sm">ไม่สามารถแสดง QR ได้</p>
                  </div>
                )}
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-left">
                  <p className="text-green-700 text-sm font-medium">📋 ขั้นตอน:</p>
                  <ol className="text-green-600 text-sm mt-1 space-y-1 list-decimal list-inside">
                    <li>เปิดแอปธนาคาร</li>
                    <li>เลือก &ldquo;พร้อมเพย์&rdquo; หรือ &ldquo;สแกน QR&rdquo;</li>
                    <li>สแกน QR ด้านบน</li>
                    <li>ยืนยันจำนวน {qrData.amount.toLocaleString()} ฿</li>
                    <li>เครดิตเข้าอัตโนมัติ ✅</li>
                  </ol>
                </div>
              </>
            )}

            {/* Transfer/Pool Provider */}
            {qrData.paymentType === 'transfer' && qrData.pool && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left space-y-2">
                  <p className="font-bold text-blue-800 text-center">🏦 โอนเงินเข้าบัญชีนี้</p>
                  <div className="bg-white rounded-xl p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ธนาคาร</span>
                      <span className="font-semibold">{qrData.pool.bankName || qrData.pool.bankCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">เลขบัญชี</span>
                      <span className="font-bold text-lg tracking-wider">{qrData.pool.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ชื่อบัญชี</span>
                      <span className="font-semibold">{qrData.pool.accountName}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-500">จำนวน</span>
                      <span className="font-bold text-blue-600 text-lg">{qrData.amount.toLocaleString()} ฿</span>
                    </div>
                  </div>
                  <p className="text-red-600 text-xs text-center font-medium">
                    ⚠️ โอนตรงยอดนี้เท่านั้น อย่าปัดเศษ
                  </p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-left">
                  <p className="text-green-700 text-sm font-medium">📋 ขั้นตอน:</p>
                  <ol className="text-green-600 text-sm mt-1 space-y-1 list-decimal list-inside">
                    <li>เปิดแอปธนาคาร → โอนเงิน</li>
                    <li>โอนเข้าบัญชีด้านบนยอด {qrData.amount.toLocaleString()} ฿</li>
                    <li>เครดิตเข้าอัตโนมัติ ✅</li>
                  </ol>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 text-gray-400 text-sm justify-center">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              กำลังรอการชำระเงิน...
            </div>

            <button onClick={() => { setQrData(null); setAmount('') }}
              className="btn-secondary w-full text-sm">
              ← เปลี่ยนจำนวน
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
