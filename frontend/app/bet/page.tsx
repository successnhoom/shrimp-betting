'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { betApi, authApi } from '@/lib/api'
import { showLocalNotification } from '@/lib/push'
import { connectSocket } from '@/lib/socket'
import { useRoundStore } from '@/store/round'
import { useAuthStore } from '@/store/auth'
import { OddsBoard } from '@/components/OddsBoard'
import { NotifBell } from '@/components/NotifBell'
import { BetPanel } from '@/components/BetPanel'
import { CustomerNav } from '@/components/CustomerNav'
import Link from 'next/link'

export default function BetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{background:'#07080f'}}><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>}>
      <BetPageInner />
    </Suspense>
  )
}

function BetPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, setUser, logout, token, _hasHydrated } = useAuthStore()
  const { round, myBets, setRound, setMyBets, updateOdds, setTimeLeft, timeLeft } = useRoundStore()
  const [walletBalance, setWalletBalance] = useState(0)
  const [resultModal, setResultModal] = useState<{
    won: boolean; amount?: number; result: string
  } | null>(null)

  // Track the last round we were betting in
  const lastRoundIdRef   = useRef<string | null>(null)
  const lastRoundBetsRef = useRef<any[]>([])
  const resultShownRef   = useRef<string | null>(null) // roundId of last shown result
  const timerRef = useRef<NodeJS.Timeout>()

  const shopId = searchParams.get('shopId') ||
    (typeof window !== 'undefined' ? localStorage.getItem('shopId') : '') ||
    'shop-demo-001'

  useEffect(() => {
    if (!_hasHydrated) return
    if (!token) router.replace('/')
  }, [_hasHydrated, token, router])

  const refreshWallet = () => {
    authApi.me().then(res => {
      setUser(res.data)
      setWalletBalance(res.data.wallet?.balance || 0)
    }).catch(() => {})
  }

  useEffect(() => { refreshWallet() }, [])

  // Poll every 3s
  const { refetch: refetchRound } = useQuery({
    queryKey: ['currentRound', shopId],
    queryFn: async () => {
      if (!shopId) return null
      const res = await betApi.getCurrentRound(shopId)
      const newRound: any = res.data.round
      const newBets: any[] = res.data.myBets || []

      // Case 1: Round is active — store bets for later
      if (newRound) {
        lastRoundIdRef.current = newRound.id
        if (newBets.length > 0) lastRoundBetsRef.current = newBets

        // Set timer
        if (newRound.status === 'open' && newRound.openedAt) {
          const openedAt = new Date(newRound.openedAt).getTime()
          const duration = parseInt(process.env.NEXT_PUBLIC_ROUND_DURATION || '180') * 1000
          const elapsed = Date.now() - openedAt
          setTimeLeft(Math.max(0, Math.floor((duration - elapsed) / 1000)))
        }

        setRound(newRound)
        setMyBets(newBets)
      }

      // Case 2: Round gone (null) but we were in one — check result
      if (!newRound && lastRoundIdRef.current && resultShownRef.current !== lastRoundIdRef.current) {
        const prevRoundId = lastRoundIdRef.current
        resultShownRef.current = prevRoundId

        // Fetch the settled round directly
        try {
          const roundRes = await betApi.getRound(prevRoundId)
          const settledRound = roundRes.data

          if (settledRound.status === 'settled') {
            // Fetch my bets for this round
            const betsRes = await betApi.myBets(prevRoundId)
            const bets: any[] = betsRes.data || []

            const wonBet  = bets.find((b: any) => b.status === 'won')
            const lostBet = bets.find((b: any) => b.status === 'lost')
            const resultLabel = settledRound.result === 'even' ? '🔵 คู่' : '🟡 คี่'

            if (wonBet) {
              setResultModal({ won: true, amount: wonBet.payout, result: resultLabel })
              showLocalNotification('🎉 คุณชนะ!', `ได้รับ ${wonBet.payout?.toLocaleString()} บาท`)
              setMyBets(bets)
            } else if (lostBet) {
              setResultModal({ won: false, result: resultLabel })
              setMyBets(bets)
            }

            // Refresh wallet after result shown
            setTimeout(refreshWallet, 300)
          } else if (settledRound.status === 'cancelled') {
            toast('รอบถูกยกเลิก เงินคืนแล้ว', { icon: '↩️' })
            setTimeout(refreshWallet, 300)
          }
        } catch { /* round might not exist */ }

        setRound(null)
      }

      return res.data
    },
    enabled: !!shopId && !!token,
    refetchInterval: 3000,
  })

  // Countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (round?.status === 'open' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(Math.max(0, timeLeft - 1)), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [round?.status, timeLeft, setTimeLeft])

  // Socket — real-time odds + trigger immediate refetch
  useEffect(() => {
    if (!shopId) return
    const socket = connectSocket(shopId)

    socket.on('round:opened', () => {
      toast('🎯 รอบใหม่เริ่มแล้ว!', { icon: '🎉' })
      showLocalNotification('🎯 รอบใหม่', 'บ่อตกกุ้งเปิดรับแทงแล้ว!')
      refetchRound()
    })

    socket.on('odds:update', ({ even, odd }: any) => {
      updateOdds(even, odd)
    })

    socket.on('round:locked', () => {
      toast('🔒 ปิดรับแทงแล้ว')
      refetchRound()
    })

    socket.on('round:settled', () => {
      // Trigger refetch immediately so we catch null round
      refetchRound()
      setTimeout(refetchRound, 1500)
    })

    socket.on('round:stopped', () => {
      toast('รอบถูกยกเลิก เงินคืนแล้ว', { icon: '↩️' })
      refetchRound()
      setTimeout(refreshWallet, 800)
    })

    return () => {
      socket.off('round:opened')
      socket.off('odds:update')
      socket.off('round:locked')
      socket.off('round:settled')
      socket.off('round:stopped')
    }
  }, [shopId])

  if (!_hasHydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#07080f' }}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!token) return null

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f0f4ff 0%,#f8fafc 30%)' }}>
      {/* Header — 3D dark */}
      <header className="sticky top-0 z-30 px-4 py-3"
        style={{
          background: 'linear-gradient(135deg,#0a0e1a,#0d1b3e)',
          borderBottom: '1px solid rgba(79,159,255,0.15)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(79,159,255,0.1)',
        }}>
        {/* Aurora shimmer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(ellipse 100% 100% at 50% -20%,rgba(79,159,255,0.15),transparent)' }} />
        </div>
        <div className="relative flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="font-black text-lg tracking-wide"
              style={{ background:'linear-gradient(135deg,#d4af37,#f5e06e)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              🦐 บ่อตกกุ้ง
            </p>
            <p className="text-blue-400/60 text-[10px] font-medium">{user?.displayName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {[{href:'/leaderboard',icon:'🏆'},{href:'/stats',icon:'📊'}].map(({href,icon}) => (
              <Link key={href} href={href}>
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all hover:scale-110"
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  {icon}
                </button>
              </Link>
            ))}
            <NotifBell />
            <Link href="/profile">
              <button className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all hover:scale-110"
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
                👤
              </button>
            </Link>
            <Link href="/wallet">
              <div className="cursor-pointer rounded-xl px-3 py-1.5 text-right transition-all hover:scale-105"
                style={{ background:'rgba(79,159,255,0.12)', border:'1px solid rgba(79,159,255,0.25)', boxShadow:'0 0 12px rgba(79,159,255,0.15)' }}>
                <p className="text-[10px] text-blue-400 font-medium">เครดิต</p>
                <p className="font-black text-white text-sm tabular-nums">{walletBalance.toLocaleString()} ฿</p>
              </div>
            </Link>
            <button onClick={() => { logout(); router.push('/') }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-400/50 text-sm hover:text-blue-300 transition-all"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
              ✕
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-32">
        <OddsBoard />

        {round?.status === 'open' && (
          <BetPanel
            roundId={round.id}
            walletBalance={walletBalance}
            onBetPlaced={() => { refreshWallet(); refetchRound() }}
          />
        )}

        {round?.status === 'locked' && (
          <div className="card text-center py-6">
            <div className="text-4xl mb-2">🔒</div>
            <p className="font-bold text-gray-700">ปิดรับแทงแล้ว</p>
            <p className="text-gray-400 text-sm">กำลังรอผลจากพนักงาน...</p>
          </div>
        )}

        {myBets.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-3">การแทงของฉัน</h3>
            <div className="space-y-2">
              {myBets.map((bet: any) => (
                <div key={bet.id} className={`flex items-center justify-between p-3 rounded-xl ${
                  bet.side === 'even' ? 'bg-blue-50' : 'bg-amber-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{bet.side === 'even' ? '🔵' : '🟡'}</span>
                    <div>
                      <p className="font-semibold text-sm">{bet.side === 'even' ? 'คู่' : 'คี่'}</p>
                      <p className="text-xs text-gray-500">{bet.amountAccepted?.toLocaleString()} บาท</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {bet.status === 'won'      && <span className="text-green-600 font-bold">+{bet.payout?.toLocaleString()} ฿</span>}
                    {bet.status === 'lost'     && <span className="text-red-500 text-sm font-medium">แพ้</span>}
                    {bet.status === 'accepted' && <span className="text-gray-400 text-sm">รอผล</span>}
                    {bet.status === 'refunded' && <span className="text-gray-500 text-sm">คืนเงิน</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <CustomerNav />

      {/* Win/Loss popup */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setResultModal(null)} />
          <div className={`relative rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-bounce-in ${
            resultModal.won
              ? 'bg-gradient-to-b from-yellow-400 to-amber-500'
              : 'bg-gradient-to-b from-gray-700 to-gray-800'
          }`}>
            <div className="text-7xl mb-4">{resultModal.won ? '🎉' : '😔'}</div>
            <h2 className={`text-3xl font-bold mb-2 ${resultModal.won ? 'text-white' : 'text-gray-200'}`}>
              {resultModal.won ? 'คุณชนะ!' : 'เสียรอบนี้'}
            </h2>
            {resultModal.won && resultModal.amount != null && (
              <p className="text-white text-2xl font-bold mb-1">
                +{Number(resultModal.amount).toLocaleString()} ฿
              </p>
            )}
            <p className={`text-lg mb-6 ${resultModal.won ? 'text-yellow-100' : 'text-gray-400'}`}>
              ผล: {resultModal.result}
            </p>
            <button
              onClick={() => setResultModal(null)}
              className={`w-full py-3 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
                resultModal.won
                  ? 'bg-white text-amber-600 hover:bg-yellow-50'
                  : 'bg-gray-600 text-white hover:bg-gray-500'
              }`}>
              {resultModal.won ? '🎯 แทงรอบต่อไป' : '↩️ รอรอบหน้า'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
