'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { walletApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import Link from 'next/link'
import { PushButton } from '@/components/PushButton'

const TX_LABELS: Record<string, string> = {
  deposit: '📱 เติมเงิน',
  withdraw: '💸 ถอนเงิน',
  bet_lock: '🔒 วางเดิมพัน',
  bet_refund: '↩️ คืนเงิน',
  payout: '🎉 รางวัล',
  shop_fee: '🏪 ค่าธรรมเนียม',
}

export default function WalletPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit')

  const { data: wallet, refetch } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get().then(r => r.data),
    enabled: !!token,
  })

  const { data: txData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => walletApi.transactions().then(r => r.data),
    enabled: !!token && tab === 'history',
  })

  async function handleDeposit() {
    const amt = parseFloat(depositAmount)
    if (!amt || amt < 20) return toast.error('ขั้นต่ำ 20 บาท')
    try {
      const res = await walletApi.deposit(amt)
      // In a real app, redirect to Stripe payment page
      // For dev, we simulate instant deposit
      toast.success(`สร้าง Payment Intent แล้ว\nID: ${res.data.paymentIntentId}`)
      window.open(`https://checkout.stripe.com/pay/${res.data.clientSecret}`, '_blank')
    } catch {
      toast.error('เติมเงินไม่สำเร็จ')
    }
  }

  async function handleWithdraw() {
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt < 100) return toast.error('ขั้นต่ำ 100 บาท')
    if (wallet && amt > wallet.balance) return toast.error('เครดิตไม่พอ')
    try {
      await walletApi.withdraw(amt)
      toast.success(`ส่งคำขอถอน ${amt.toLocaleString()} บาท แล้ว`)
      setWithdrawAmount('')
      refetch()
    } catch {
      toast.error('ถอนเงินไม่สำเร็จ')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/bet" className="text-blue-300">← กลับ</Link>
        <h1 className="font-bold text-lg">กระเป๋าเงิน</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Balance card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white">
          <p className="text-blue-200 text-sm">ยอดคงเหลือ</p>
          <p className="text-4xl font-bold mt-1">{wallet?.balance.toLocaleString() ?? '–'} <span className="text-2xl">฿</span></p>
          {wallet?.lockedAmount > 0 && (
            <p className="text-blue-200 text-sm mt-2">🔒 ล็อคไว้ {wallet.lockedAmount.toLocaleString()} ฿</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
          {(['deposit', 'withdraw', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
              }`}>
              {t === 'deposit' ? '📱 เติมเงิน' : t === 'withdraw' ? '💸 ถอน' : '📋 ประวัติ'}
            </button>
          ))}
        </div>

        {/* Deposit — QR Code only */}
        {tab === 'deposit' && (
          <div className="card space-y-5 text-center py-6">
            <div className="text-6xl">📱</div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">เติมเครดิตผ่าน QR Code</h3>
              <p className="text-gray-500 text-sm mt-1">สแกนจ่ายผ่าน PromptPay ได้ทุกธนาคาร</p>
            </div>
            <Link href="/wallet/promptpay">
              <button className="btn-primary w-full text-lg py-4">
                🟢 สร้าง QR Code เติมเงิน
              </button>
            </Link>
            <p className="text-gray-400 text-xs">รองรับทุกธนาคาร · กรุงไทย · กสิกร · SCB · ทหารไทย และอื่นๆ</p>
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-2 pt-3 border-t border-gray-100">
                <p className="text-xs text-amber-500 font-medium mb-2">🔧 DEV MODE — เติมเงินทดสอบ</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {[100, 500, 1000].map(amt => (
                    <button key={amt} onClick={async () => {
                      try {
                        const { api } = await import('@/lib/api')
                        const { useAuthStore } = await import('@/store/auth')
                        const userId = useAuthStore.getState().user?.id
                        if (!userId) return
                        await api.post(`/admin/users/${userId}/adjust-balance`, { amount: amt, note: 'Dev test deposit' })
                        toast.success(`เติม ${amt} ฿ แล้ว (dev)`)
                        refetch()
                      } catch { toast.error('ไม่สำเร็จ — ต้องล็อกอินเป็น admin') }
                    }} className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100">
                      +{amt.toLocaleString()} ฿
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'deposit' && <PushButton />}

        {/* Withdraw */}
        {tab === 'withdraw' && (
          <div className="card space-y-4">
            <h3 className="font-bold">ถอนเครดิต</h3>
            <p className="text-sm text-gray-500">ยอดที่ถอนได้: <strong>{wallet?.balance.toLocaleString()}</strong> ฿</p>
            <div className="relative">
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                className="input pr-12" placeholder="จำนวนเงิน (ขั้นต่ำ 100)" inputMode="numeric" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
            </div>
            <button onClick={handleWithdraw} className="btn-primary w-full">ส่งคำขอถอน</button>
            <p className="text-gray-400 text-xs text-center">ดำเนินการภายใน 24 ชั่วโมง</p>
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div className="card">
            <h3 className="font-bold mb-3">ประวัติธุรกรรม</h3>
            {!txData?.data?.length ? (
              <p className="text-gray-400 text-center py-6">ไม่มีรายการ</p>
            ) : (
              <div className="space-y-2">
                {txData.data.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{TX_LABELS[tx.type] || tx.type}</p>
                      <p className="text-xs text-gray-400">{dayjs(tx.createdAt).format('DD/MM HH:mm')}</p>
                    </div>
                    <span className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ฿
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
