'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { staffApi, adminApi, api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth'
import dayjs from 'dayjs'

type Tab = 'control' | 'live' | 'deposits' | 'withdrawals' | 'members' | 'history'

export default function StaffPage() {
  const router      = useRouter()
  const qc          = useQueryClient()
  const { user, token, isStaff, logout, _hasHydrated } = useAuthStore()
  const [currentRoundId, setCurrentRoundId]   = useState<string | null>(null)
  const [roundStatus, setRoundStatus]         = useState<string>('idle')
  const [isLoading, setIsLoading]             = useState(false)
  const [tab, setTab]                         = useState<Tab>('control')
  const [confirmDeposit, setConfirmDeposit]   = useState<{ id: string; user: any; amount: number } | null>(null)
  const [memberSearch, setMemberSearch]       = useState('')
  const [memberSelected, setMemberSelected]   = useState<any>(null)
  const [creditForm, setCreditForm]           = useState({ amount: '', note: '' })
  const [creditLoading, setCreditLoading]     = useState(false)

  const shopId = typeof window !== 'undefined'
    ? (localStorage.getItem('shopId') || 'shop-demo-001') : 'shop-demo-001'

  useEffect(() => {
    if (!_hasHydrated) return
    if (!token || !isStaff()) router.replace('/')
  }, [_hasHydrated, token])

  // ── Queries ────────────────────────────────────────────────
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['staffSummary', shopId],
    queryFn:  () => staffApi.summary(shopId).then(r => r.data),
    enabled:  !!token && !!shopId,
    refetchInterval: 10_000,
  })

  const { data: rounds, refetch: refetchRounds } = useQuery({
    queryKey: ['staffRounds', shopId],
    queryFn:  () => staffApi.rounds(shopId).then(r => r.data),
    enabled:  !!token && !!shopId,
  })

  const { data: liveBets, refetch: refetchLive } = useQuery({
    queryKey: ['staffLiveBets', currentRoundId],
    queryFn:  () => currentRoundId ? staffApi.getRoundBets(currentRoundId).then(r => r.data) : null,
    enabled:  !!currentRoundId && (roundStatus === 'open' || roundStatus === 'locked'),
    refetchInterval: 3_000,
  })

  const { data: membersData, refetch: refetchMembers } = useQuery({
    queryKey: ['staffMembers', memberSearch],
    queryFn:  () => api.get(`/staff/members?q=${memberSearch}&page=1`).then(r => r.data),
    enabled:  !!token && tab === 'members',
  })

  const { data: pendingWithdrawals, refetch: refetchWithdrawals } = useQuery({
    queryKey: ['staffWithdrawals'],
    queryFn:  () => adminApi.getWithdrawals().then(r => r.data),
    enabled:  !!token && tab === 'withdrawals',
    refetchInterval: 15_000,
  })
  const withdrawalCount = pendingWithdrawals?.length ?? 0
  const prevWithdrawalCount = useRef(0)

  // Alert when new withdrawal arrives
  useEffect(() => {
    const pending = pendingWithdrawals?.filter((w: any) => w.status !== 'approved') ?? []
    if (pending.length > prevWithdrawalCount.current && prevWithdrawalCount.current >= 0) {
      const diff = pending.length - prevWithdrawalCount.current
      if (diff > 0 && prevWithdrawalCount.current > 0) {
        toast(`💸 มีคำขอถอนเงินใหม่ ${diff} รายการ`, {
          duration: 6000,
          style: { background: '#1e40af', color: 'white', fontWeight: 'bold' },
        })
      }
    }
    prevWithdrawalCount.current = pending.length
  }, [pendingWithdrawals])

  const { data: pendingDeposits, refetch: refetchDeposits } = useQuery({
    queryKey: ['pendingDeposits', shopId],
    queryFn:  () => staffApi.pendingDeposits(shopId).then(r => r.data),
    enabled:  !!token && tab === 'deposits',
    refetchInterval: 15_000,
  })

  // ── Set current open round ─────────────────────────────────
  useEffect(() => {
    if (!rounds) return
    const open = rounds.find((r: any) => r.status === 'open' || r.status === 'locked')
    if (open) { setCurrentRoundId(open.id); setRoundStatus(open.status) }
    else       { setCurrentRoundId(null);   setRoundStatus('idle') }
  }, [rounds])

  // ── Socket ─────────────────────────────────────────────────
  useEffect(() => {
    if (!shopId) return undefined
    const socket = connectSocket(shopId)
    socket.emit('join:staff', shopId)
    const refresh = () => { refetchRounds(); refetchSummary(); refetchLive() }
    socket.on('round:opened', refresh)
    socket.on('round:settled', refresh)
    socket.on('round:stopped', refresh)
    socket.on('odds:update', refetchLive)
    return () => { socket.off('round:opened').off('round:settled').off('round:stopped').off('odds:update') }
  }, [shopId])

  // ── Actions ────────────────────────────────────────────────
  async function handleOpenRound() {
    setIsLoading(true)
    try {
      const res = await staffApi.openRound(shopId)
      setCurrentRoundId(res.data.roundId); setRoundStatus('open')
      toast.success('🎯 เปิดรอบใหม่แล้ว!'); refetchRounds()
    } catch (e: any) { toast.error(e.response?.data?.error || 'เปิดรอบไม่ได้') }
    finally { setIsLoading(false) }
  }

  async function handleSettle(result: 'even' | 'odd') {
    if (!currentRoundId) return
    setIsLoading(true)
    try {
      await staffApi.settleRound(currentRoundId, result)
      toast.success(`✅ ออกผล ${result === 'even' ? '🔵 คู่' : '🟡 คี่'} แล้ว`)
      setRoundStatus('settled'); setCurrentRoundId(null)
      refetchRounds(); refetchSummary()
    } catch (e: any) { toast.error(e.response?.data?.error || 'ออกผลไม่ได้') }
    finally { setIsLoading(false) }
  }

  async function handleStop() {
    if (!currentRoundId || !confirm('ยืนยันยกเลิกรอบ? เงินทั้งหมดจะคืน')) return
    setIsLoading(true)
    try {
      await staffApi.stopRound(currentRoundId)
      toast.success('ยกเลิกรอบแล้ว เงินคืนทุกคน')
      setRoundStatus('idle'); setCurrentRoundId(null); refetchRounds()
    } catch (e: any) { toast.error(e.response?.data?.error || 'ยกเลิกไม่ได้') }
    finally { setIsLoading(false) }
  }

  async function handleNext() {
    if (!currentRoundId) return handleOpenRound()
    setIsLoading(true)
    try {
      const res = await staffApi.nextRound(currentRoundId)
      setCurrentRoundId(res.data.roundId); setRoundStatus('open')
      toast.success('🎯 รอบถัดไปเปิดแล้ว!'); refetchRounds()
    } catch (e: any) { toast.error(e.response?.data?.error || 'เปิดต่อไม่ได้') }
    finally { setIsLoading(false) }
  }

  async function handleAdjustCredit() {
    if (!memberSelected) return
    const amount = parseFloat(creditForm.amount)
    if (isNaN(amount) || amount === 0) return toast.error('กรุณากรอกจำนวน')
    if (!creditForm.note.trim()) return toast.error('กรุณากรอกหมายเหตุ')
    setCreditLoading(true)
    try {
      await api.post(`/staff/members/${memberSelected.id}/adjust`, { amount, note: creditForm.note })
      toast.success(`${amount > 0 ? 'เพิ่ม' : 'หัก'} ${Math.abs(amount).toLocaleString()} ฿ แล้ว`)
      setMemberSelected(null)
      setCreditForm({ amount: '', note: '' })
      refetchMembers()
    } catch (e: any) { toast.error(e.response?.data?.error || 'ไม่สำเร็จ') }
    finally { setCreditLoading(false) }
  }

  async function handleConfirmDeposit(userId: string, amount: number) {
    try {
      await staffApi.confirmDeposit(userId, amount)
      toast.success(`✅ เติม ${amount.toLocaleString()} ฿ แล้ว`)
      setConfirmDeposit(null); refetchDeposits()
    } catch { toast.error('ยืนยันไม่สำเร็จ') }
  }

  const TAB_ITEMS: { id: Tab; label: string; icon: string }[] = [
    { id: 'control',  label: 'ควบคุม',  icon: '🎮' },
    { id: 'live',     label: 'Live',     icon: '📡' },
    { id: 'deposits',    label: 'เติมเงิน', icon: '💚' },
    { id: 'withdrawals', label: 'ถอนเงิน',  icon: '💸' },
    { id: 'members',  label: 'สมาชิก',  icon: '👥' },
    { id: 'history',  label: 'ประวัติ',  icon: '📋' },
  ]

  if (!_hasHydrated) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/30 text-sm">กำลังโหลด...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="font-bold text-lg">🦐 Staff Panel</p>
          <p className="text-gray-400 text-xs">{user?.displayName}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Round status pill */}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            roundStatus === 'open'   ? 'bg-green-500/20 text-green-400' :
            roundStatus === 'locked' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-700 text-gray-400'
          }`}>
            {roundStatus === 'open' ? '🟢 เปิด' : roundStatus === 'locked' ? '🟡 ล็อค' : '⚫ ว่าง'}
          </span>
          <button onClick={() => { logout(); router.push('/') }} className="text-gray-400 text-sm">ออก</button>
        </div>
      </header>

      {/* Today stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          {[
            { label: 'รอบ', value: summary.totalRounds },
            { label: 'ยอดรวม', value: `${(summary.totalVolume ?? 0).toLocaleString()} ฿` },
            { label: 'รายได้', value: `${(summary.shopFee ?? 0).toLocaleString()} ฿`, green: true },
          ].map(s => (
            <div key={s.label} className="bg-gray-800 rounded-xl p-2.5 text-center">
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className={`font-bold mt-0.5 ${s.green ? 'text-green-400' : ''}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        {TAB_ITEMS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">

        {/* ── CONTROL TAB ── */}
        {tab === 'control' && (
          <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-lg">ควบคุมรอบ</h2>

            {roundStatus === 'idle' && (
              <button onClick={handleOpenRound} disabled={isLoading}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-6 rounded-2xl text-xl transition-all active:scale-95">
                {isLoading ? '⏳' : '▶️ เปิดรอบใหม่'}
              </button>
            )}

            {(roundStatus === 'open' || roundStatus === 'locked') && (
              <div className="space-y-3">
                {/* Live odds bar */}
                {liveBets?.summary && (
                  <div className="bg-gray-700 rounded-xl p-3">
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-blue-400">🔵 คู่ {liveBets.summary.evenTotal.toLocaleString()} ฿</span>
                      <span className="text-gray-400 text-xs">{liveBets.summary.count} ใบ</span>
                      <span className="text-amber-400">🟡 คี่ {liveBets.summary.oddTotal.toLocaleString()} ฿</span>
                    </div>
                    {liveBets.summary.total > 0 && (() => {
                      const ep = (liveBets.summary.evenTotal / liveBets.summary.total) * 100
                      return (
                        <div className="h-3 bg-gray-600 rounded-full overflow-hidden flex">
                          <div className="bg-blue-500 transition-all duration-500" style={{ width: `${ep}%` }} />
                          <div className="bg-amber-400 transition-all duration-500" style={{ width: `${100-ep}%` }} />
                        </div>
                      )
                    })()}
                    {liveBets.summary.evenTotal !== liveBets.summary.oddTotal && liveBets.summary.total > 0 && (
                      <p className="text-yellow-400 text-xs text-center mt-1">
                        ⚠️ ต่างกัน {Math.abs(liveBets.summary.evenTotal - liveBets.summary.oddTotal).toLocaleString()} ฿
                      </p>
                    )}
                  </div>
                )}
                <p className="text-gray-400 text-sm text-center">ชั่งตราชั่งแล้ว — เลือกผล:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleSettle('even')} disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-8 rounded-2xl text-3xl transition-all active:scale-95">
                    🔵<br/><span className="text-lg">คู่</span>
                  </button>
                  <button onClick={() => handleSettle('odd')} disabled={isLoading}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-8 rounded-2xl text-3xl transition-all active:scale-95">
                    🟡<br/><span className="text-lg">คี่</span>
                  </button>
                </div>
                <button onClick={handleStop} disabled={isLoading}
                  className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold py-3 rounded-xl text-sm transition-all">
                  ❌ ยกเลิกรอบ (คืนเงินทั้งหมด)
                </button>
              </div>
            )}

            {roundStatus === 'settled' && (
              <button onClick={handleNext} disabled={isLoading}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-6 rounded-2xl text-xl transition-all active:scale-95">
                {isLoading ? '⏳' : '▶️ รอบถัดไป'}
              </button>
            )}
          </div>
        )}

        {/* ── LIVE TAB ── */}
        {tab === 'live' && (
          <div className="space-y-3">
            {!currentRoundId ? (
              <div className="bg-gray-800 rounded-2xl p-6 text-center text-gray-400">
                <p className="text-3xl mb-2">⏳</p>
                <p>ยังไม่มีรอบที่เปิดอยู่</p>
              </div>
            ) : liveBets ? (
              <>
                {/* Summary bar */}
                <div className="bg-gray-800 rounded-2xl p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-blue-400 font-bold">🔵 คู่ {liveBets.summary.evenTotal.toLocaleString()} ฿</span>
                    <span className="text-gray-400 text-xs">{liveBets.summary.count} ใบ · {liveBets.summary.total.toLocaleString()} ฿</span>
                    <span className="text-amber-400 font-bold">🟡 คี่ {liveBets.summary.oddTotal.toLocaleString()} ฿</span>
                  </div>
                  {/* Balance bar */}
                  {liveBets.summary.total > 0 && (() => {
                    const ep = (liveBets.summary.evenTotal / liveBets.summary.total) * 100
                    return (
                      <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 transition-all" style={{ width: `${ep}%` }} />
                        <div className="bg-amber-400 transition-all" style={{ width: `${100 - ep}%` }} />
                      </div>
                    )
                  })()}
                  {liveBets.summary.evenTotal !== liveBets.summary.oddTotal && (
                    <p className="text-xs text-yellow-400 mt-2 text-center">
                      ⚠️ ยอดไม่เท่า — ส่วนเกิน {Math.abs(liveBets.summary.evenTotal - liveBets.summary.oddTotal).toLocaleString()} ฿ จะถูกตัดอัตโนมัติ
                    </p>
                  )}
                </div>

                {/* Bet list */}
                <div className="bg-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-gray-700 flex justify-between text-xs text-gray-400">
                    <span>ผู้แทง</span>
                    <span>ฝั่ง / จำนวน</span>
                  </div>
                  <div className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
                    {liveBets.bets.length === 0 ? (
                      <p className="text-center text-gray-500 py-6">ยังไม่มีการแทง</p>
                    ) : liveBets.bets.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium">{b.user.displayName}</p>
                          <p className="text-xs text-gray-500">{dayjs(b.createdAt).format('HH:mm:ss')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            b.side === 'even' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {b.side === 'even' ? '🔵 คู่' : '🟡 คี่'}
                          </span>
                          <span className="font-bold text-sm">{b.amountAccepted.toLocaleString()} ฿</span>
                          {b.status === 'refunded' && <span className="text-xs text-gray-500">คืนแล้ว</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-6 text-center text-gray-400">กำลังโหลด...</div>
            )}
          </div>
        )}

        {/* ── DEPOSITS TAB ── */}
        {tab === 'deposits' && (
          <div className="space-y-3">
            <h2 className="font-bold">💚 รอยืนยัน PromptPay</h2>
            {!pendingDeposits?.length ? (
              <div className="bg-gray-800 rounded-2xl p-6 text-center text-gray-400">
                <p className="text-2xl mb-2">✅</p><p>ไม่มีรายการรอ</p>
              </div>
            ) : pendingDeposits.map((d: any) => (
              <div key={d.id} className="bg-gray-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{d.user.displayName}</p>
                  <p className="text-gray-400 text-sm">{d.user.phone}</p>
                  <p className="text-xs text-gray-500">{dayjs(d.createdAt).format('HH:mm')} น.</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-400">{d.amount.toLocaleString()} ฿</p>
                  <button
                    onClick={() => setConfirmDeposit(d)}
                    className="mt-1 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                    ✓ ยืนยัน
                  </button>
                </div>
              </div>
            ))}

            {/* Confirm modal */}
            {confirmDeposit && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDeposit(null)} />
                <div className="relative bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
                  <h3 className="font-bold text-lg text-center">ยืนยันเติมเงิน</h3>
                  <div className="bg-gray-700 rounded-xl p-4 text-center space-y-1">
                    <p className="text-gray-300">{confirmDeposit.user.displayName}</p>
                    <p className="text-3xl font-bold text-green-400">{confirmDeposit.amount.toLocaleString()} ฿</p>
                    <p className="text-gray-400 text-sm">ตรวจสอบสลิปโอนเงินก่อนยืนยัน</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setConfirmDeposit(null)}
                      className="py-3 rounded-xl bg-gray-700 text-gray-300 font-semibold">ยกเลิก</button>
                    <button onClick={() => handleConfirmDeposit(confirmDeposit.user.id, confirmDeposit.amount)}
                      className="py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold">
                      ✓ ยืนยัน
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="space-y-3">
            <h2 className="font-bold">👥 สมาชิก</h2>

            {/* Search */}
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="🔍 ค้นหาชื่อหรือเบอร์โทร"
            />

            {/* Member list */}
            {membersData?.data?.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-6 text-center text-gray-400">ไม่พบสมาชิก</div>
            ) : (
              <div className="bg-gray-800 rounded-2xl divide-y divide-gray-700">
                {membersData?.data?.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-sm">{m.displayName}</p>
                      <p className="text-gray-400 text-xs">{m.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-1">
                        <p className="font-bold text-sm text-green-400">{m.balance.toLocaleString()} ฿</p>
                      </div>
                      <button
                        onClick={() => { setMemberSelected(m); setCreditForm({ amount: '', note: '' }) }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all">
                        ปรับเครดิต
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Adjust credit modal */}
            {memberSelected && (
              <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
                <div className="absolute inset-0 bg-black/70" onClick={() => setMemberSelected(null)} />
                <div className="relative bg-gray-800 rounded-2xl w-full max-w-sm space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">💰 ปรับเครดิต</h3>
                    <button onClick={() => setMemberSelected(null)} className="text-gray-400 text-2xl">×</button>
                  </div>

                  <div className="bg-gray-700 rounded-xl p-3 text-center">
                    <p className="text-gray-300 text-sm">{memberSelected.displayName} · {memberSelected.phone}</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{memberSelected.balance?.toLocaleString()} ฿</p>
                  </div>

                  {/* Quick buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {[100, 200, 500, 1000].map(a => (
                      <button key={a} onClick={() => setCreditForm(f => ({ ...f, amount: a.toString() }))}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          creditForm.amount === a.toString() ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}>
                        +{a.toLocaleString()}
                      </button>
                    ))}
                    {[-100, -200].map(a => (
                      <button key={a} onClick={() => setCreditForm(f => ({ ...f, amount: a.toString() }))}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          creditForm.amount === a.toString() ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}>
                        {a.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  <input
                    value={creditForm.amount}
                    onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))}
                    type="number"
                    placeholder="จำนวน (+เพิ่ม / -หัก)"
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <input
                    value={creditForm.note}
                    onChange={e => setCreditForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="หมายเหตุ เช่น เติมเงินสด, แก้ไขยอด"
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setMemberSelected(null)}
                      className="py-3 rounded-xl bg-gray-700 text-gray-300 font-semibold">ยกเลิก</button>
                    <button
                      onClick={handleAdjustCredit}
                      disabled={creditLoading || !creditForm.amount || !creditForm.note.trim()}
                      className={`py-3 rounded-xl font-bold disabled:opacity-50 transition-all ${
                        parseFloat(creditForm.amount) < 0
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}>
                      {creditLoading ? '⏳' : parseFloat(creditForm.amount || '0') < 0
                        ? `หัก ${Math.abs(parseFloat(creditForm.amount||'0')).toLocaleString()} ฿`
                        : `เพิ่ม ${parseFloat(creditForm.amount||'0').toLocaleString()} ฿`
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WITHDRAWALS TAB ── */}
        {tab === 'withdrawals' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">💸 คำขอถอนเงิน</h2>
              {withdrawalCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                  {withdrawalCount} รายการ
                </span>
              )}
            </div>

            {!pendingWithdrawals?.length ? (
              <div className="bg-gray-800 rounded-2xl p-6 text-center text-gray-400">
                <p className="text-2xl mb-2">✅</p>
                <p>ไม่มีคำขอถอนเงิน</p>
              </div>
            ) : pendingWithdrawals.map((w: any) => (
              <div key={w.id} className="bg-gray-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{w.user?.displayName}</p>
                  <p className="text-gray-400 text-sm">{w.user?.phone}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(w.createdAt).toLocaleString('th-TH')}
                  </p>
                  {w.status === 'approved' && (
                    <span className="text-xs text-green-400 font-medium">✓ อนุมัติแล้ว</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-red-400">{w.amount?.toLocaleString()} ฿</p>
                  {w.status !== 'approved' && (
                    <button
                      onClick={async () => {
                        try {
                          await adminApi.approveWithdrawal(w.id)
                          toast.success('อนุมัติแล้ว')
                          refetchWithdrawals()
                        } catch { toast.error('ไม่สำเร็จ') }
                      }}
                      className="mt-1.5 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                      ✓ อนุมัติ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && rounds && (
          <div className="bg-gray-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="font-bold">รอบล่าสุด</h3>
            </div>
            <div className="divide-y divide-gray-700">
              {rounds.slice(0, 15).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {r.result === 'even' ? '🔵' : r.result === 'odd' ? '🟡' : r.status === 'cancelled' ? '❌' : '⏳'}
                    </span>
                    <div>
                      <p className="text-sm font-medium">รอบ #{r.id.slice(-6)}</p>
                      <p className="text-xs text-gray-500">{r.betCount} ใบ · {dayjs(r.openedAt).format('HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{(r.totalEven + r.totalOdd).toLocaleString()} ฿</p>
                    <p className="text-xs text-gray-500">
                      {r.result === 'even' ? 'คู่' : r.result === 'odd' ? 'คี่' : r.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
