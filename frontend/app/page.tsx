'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Logo } from '@/components/Logo'

type Step = 'landing' | 'phone' | 'otp' | 'register'

export default function Home() {
  const router = useRouter()
  const { setAuth, token, user, _hasHydrated } = useAuthStore()
  const [step, setStep] = useState<Step>('landing')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState<string>()
  const { register, handleSubmit, formState: { errors } } = useForm<any>()

  // ถ้า login อยู่แล้ว redirect ทันทีที่ hydrate เสร็จ
  useEffect(() => {
    if (!_hasHydrated) return
    if (token && user) {
      if (user.role === 'admin') router.replace('/admin')
      else if (user.role === 'staff') router.replace('/staff')
      else router.replace('/bet')
    }
  }, [_hasHydrated, token, user, router])

  async function onSendOtp({ phone }: any) {
    setLoading(true)
    try {
      const res = await authApi.sendOtp(phone)
      setPhone(phone)
      if (res.data.devCode) setDevOtp(res.data.devCode)
      else toast.success('ส่ง OTP แล้ว')
      setStep('otp')
    } catch { toast.error('ส่ง OTP ไม่ได้') }
    finally { setLoading(false) }
  }

  async function onVerifyOtp({ otp }: any) {
    setLoading(true)
    try {
      const res = await authApi.login(phone, otp)
      setAuth(res.data.token, res.data.user)
      toast.success(`ยินดีต้อนรับ ${res.data.user.displayName}!`)
      const role = res.data.user.role
      if (role === 'admin') router.push('/admin')
      else if (role === 'staff') router.push('/staff')
      else router.push('/bet')
    } catch (e: any) {
      if (e.response?.status === 404) setStep('register')
      else toast.error('รหัส OTP ไม่ถูกต้อง')
    } finally { setLoading(false) }
  }

  async function onRegister({ displayName }: any) {
    setLoading(true)
    try {
      const otpRes = await authApi.sendOtp(phone)
      const code = otpRes.data.devCode
      const res = await authApi.register(phone, displayName, code)
      setAuth(res.data.token, res.data.user)
      toast.success('สมัครสมาชิกสำเร็จ!')
      router.push('/bet')
    } catch { toast.error('สมัครไม่สำเร็จ') }
    finally { setLoading(false) }
  }

  // รอ hydrate — แสดง spinner เพื่อไม่ให้หน้าขาว
  if (!_hasHydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#07080f' }}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (token && user) return null // redirecting

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: '#07080f' }}>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 30%,rgba(37,99,235,0.15),transparent),radial-gradient(ellipse 60% 50% at 80% 20%,rgba(168,85,247,0.1),transparent),radial-gradient(ellipse 50% 40% at 50% 80%,rgba(6,182,212,0.07),transparent)' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '50px 50px' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">

        {/* Landing — before login */}
        {step === 'landing' && (
          <div className="text-center space-y-8 max-w-md w-full">
            {/* Hero */}
            <div className="space-y-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 blur-3xl opacity-40 rounded-full" style={{ background: '#1d4ed8', transform: 'scale(2)' }} />
                <Logo size={160} className="relative drop-shadow-2xl" />
              </div>
              <p className="text-blue-400/70 text-lg font-medium">ระบบเดิมพันออนไลน์ · Premium</p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🎯', label: 'แทงง่าย', desc: 'คู่ / คี่' },
                { icon: '⚡', label: 'Real-time', desc: 'ผลทันที' },
                { icon: '🔒', label: 'ปลอดภัย', desc: '100%' },
              ].map(f => (
                <div key={f.label} className="rounded-2xl p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-2xl">{f.icon}</p>
                  <p className="text-white text-xs font-bold mt-1">{f.label}</p>
                  <p className="text-white/30 text-[10px]">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <button onClick={() => setStep('phone')}
                className="w-full py-5 rounded-2xl font-black text-xl text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg,#4f9fff,#2563eb)',
                  boxShadow: '0 5px 0 #1a3f9f, 0 8px 30px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}>
                🔑 เข้าสู่ระบบ
              </button>
              <button onClick={() => { setStep('phone') }}
                className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg,#a855f7,#7c3aed)',
                  boxShadow: '0 5px 0 #4c1d95, 0 8px 30px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}>
                ✨ สมัครสมาชิกใหม่
              </button>
              <p className="text-white/20 text-xs">ไม่มีค่าสมัคร · ฟรีตลอด</p>
            </div>
          </div>
        )}

        {/* Phone step */}
        {step === 'phone' && (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-black text-white">เข้าสู่ระบบ</h2>
              <p className="text-blue-400/60 text-sm mt-1">กรอกเบอร์โทรเพื่อรับ OTP</p>
            </div>
            <form onSubmit={handleSubmit(onSendOtp)} className="space-y-4">
              <div className="border-gradient p-px rounded-2xl">
                <input {...register('phone', { required: true, pattern: { value: /^0[0-9]{8,9}$/, message: 'เบอร์ไม่ถูกต้อง' } })}
                  className="w-full px-5 py-4 text-xl font-bold text-white rounded-[14px] focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none' }}
                  placeholder="08xxxxxxxx" inputMode="tel" maxLength={10} autoFocus />
              </div>
              {errors.phone && <p className="text-red-400 text-sm text-center">{String(errors.phone.message || 'กรุณากรอกเบอร์')}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-lg text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#4f9fff,#2563eb)', boxShadow: '0 4px 0 #1a3f9f, 0 8px 24px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                {loading ? '⏳' : 'รับรหัส OTP →'}
              </button>
              <button type="button" onClick={() => setStep('landing')}
                className="w-full py-2 text-white/30 text-sm hover:text-white/50">← กลับ</button>
            </form>
          </div>
        )}

        {/* OTP step */}
        {step === 'otp' && (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-black text-white">กรอก OTP</h2>
              <p className="text-blue-400/60 text-sm mt-1">ส่งไปที่ {phone}</p>
            </div>
            {devOtp && (
              <div className="rounded-2xl p-4 text-center" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}>
                <p className="text-xs uppercase tracking-wider mb-1 font-bold" style={{ color: '#92400e' }}>🔧 Dev Mode OTP</p>
                <p className="text-4xl font-black tracking-[0.4em]" style={{ color: '#000000' }}>{devOtp}</p>
              </div>
            )}
            <form onSubmit={handleSubmit(onVerifyOtp)} className="space-y-4">
              <input {...register('otp', { required: true })}
                className="w-full py-5 text-4xl font-black text-center tracking-[0.5em] rounded-2xl focus:outline-none"
                style={{
                  background: '#ffffff',
                  border: '2px solid rgba(79,159,255,0.6)',
                  color: '#000000',
                  caretColor: '#2563eb',
                  WebkitTextFillColor: '#000000',
                }}
                placeholder="——————" inputMode="numeric" maxLength={6} autoFocus />
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-lg text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 0 #065f46, 0 8px 24px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                {loading ? '⏳' : '✓ ยืนยัน OTP'}
              </button>
              <button type="button" onClick={() => setStep('phone')}
                className="w-full py-2 text-white/30 text-sm hover:text-white/50">← เปลี่ยนเบอร์</button>
            </form>
          </div>
        )}

        {/* Register step */}
        {step === 'register' && (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <p className="text-5xl mb-3">🎉</p>
              <h2 className="text-3xl font-black text-white">สมัครสมาชิก</h2>
              <p className="text-blue-400/60 text-sm mt-1">ยินดีต้อนรับ! กรอกชื่อของคุณ</p>
            </div>
            <form onSubmit={handleSubmit(onRegister)} className="space-y-4">
              <input {...register('displayName', { required: true, minLength: 2 })}
                className="w-full px-5 py-4 text-lg font-bold text-white rounded-2xl focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)' }}
                placeholder="ชื่อเล่น / ชื่อจริง" autoFocus />
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-lg text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)', boxShadow: '0 4px 0 #4c1d95, 0 8px 24px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                {loading ? '⏳' : '✨ สมัครเลย'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
