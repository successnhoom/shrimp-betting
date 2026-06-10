'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type Step = 'phone' | 'otp' | 'register'

export default function AuthPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [step, setStep]               = useState<Step>('phone')
  const [phone, setPhone]             = useState('')
  const [registerToken, setRegisterToken] = useState('')
  const [loading, setLoading]         = useState(false)
  const [devOtp, setDevOtp]           = useState<string>()
  const { register, handleSubmit, formState: { errors } } = useForm<any>()

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
      toast.success(`ยินดีต้อนรับ!`)
      router.push(['staff','admin'].includes(res.data.user.role) ? '/staff' : '/bet')
    } catch (e: any) {
      if (e.response?.status === 404) {
        setRegisterToken(e.response.data.registerToken || '')
        setStep('register')
      } else {
        toast.error('รหัส OTP ไม่ถูกต้อง')
      }
    } finally { setLoading(false) }
  }

  async function onRegister({ displayName }: any) {
    if (!registerToken) { toast.error('กรุณาขอ OTP ใหม่'); setStep('phone'); return }
    setLoading(true)
    try {
      const res = await authApi.register(phone, displayName, registerToken)
      setAuth(res.data.token, res.data.user)
      toast.success('สมัครสำเร็จ! 🎉')
      router.push('/bet')
    } catch (e: any) {
      const msg = e.response?.data?.error || 'สมัครไม่สำเร็จ'
      if (e.response?.status === 400) {
        toast.error('หมดเวลา กรุณาขอ OTP ใหม่')
        setStep('phone')
      } else {
        toast.error(msg)
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-mesh relative overflow-hidden"
      style={{ background: '#07080f' }}>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse-slow"
          style={{ background: 'radial-gradient(#2563eb,transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15 animate-pulse-slow"
          style={{ background: 'radial-gradient(#a855f7,transparent)', animationDelay: '1.5s' }} />
        <div className="absolute top-3/4 left-1/2 w-[300px] h-[300px] rounded-full blur-[80px] opacity-10"
          style={{ background: 'radial-gradient(#00e5ff,transparent)' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative w-full max-w-sm space-y-8 z-10">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-60 bg-blue-500 scale-150" />
            <div className="relative text-7xl animate-float">🦐</div>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-gradient-gold">บ่อตกกุ้ง</h1>
          <p className="text-blue-400/60 text-sm tracking-widest uppercase font-medium">Premium Betting · v2.0</p>
        </div>

        {/* Glass card */}
        <div className="border-gradient p-px">
          <div className="rounded-[18.5px] p-6 space-y-5"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
              backdropFilter: 'blur(40px)',
            }}>

            {step === 'phone' && (
              <form onSubmit={handleSubmit(onSendOtp)} className="space-y-4">
                <h2 className="text-xl font-black text-white text-center">เข้าสู่ระบบ</h2>
                <div>
                  <label className="block text-xs font-semibold text-blue-300/70 mb-2 uppercase tracking-wider">เบอร์โทรศัพท์</label>
                  <input {...register('phone',{required:true,pattern:{value:/^0[0-9]{8,9}$/,message:'เบอร์ไม่ถูกต้อง'}})}
                    className="w-full px-4 py-3.5 rounded-xl text-lg font-bold text-white placeholder-white/20 focus:outline-none transition-all"
                    style={{
                      background:'rgba(255,255,255,0.07)',
                      border:'1.5px solid rgba(255,255,255,0.12)',
                    }}
                    onFocus={e => { e.target.style.border='1.5px solid rgba(79,159,255,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(79,159,255,0.15)' }}
                    onBlur={e => { e.target.style.border='1.5px solid rgba(255,255,255,0.12)'; e.target.style.boxShadow='none' }}
                    placeholder="08xxxxxxxx" inputMode="tel" maxLength={10} />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{String(errors.phone.message||'')}</p>}
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-xl font-black text-lg text-white transition-all disabled:opacity-50"
                  style={{
                    background:'linear-gradient(135deg,#4f9fff,#2563eb)',
                    boxShadow:'0 4px 0 #1a3f9f, 0 8px 24px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}>
                  {loading ? '⏳' : 'รับรหัส OTP →'}
                </button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleSubmit(onVerifyOtp)} className="space-y-4">
                <h2 className="text-xl font-black text-white text-center">กรอก OTP</h2>
                <p className="text-center text-blue-300/60 text-sm">{phone}</p>
                {devOtp && (
                  <div className="rounded-xl px-4 py-3 text-center"
                    style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)' }}>
                    <p className="text-amber-400 text-[10px] uppercase tracking-wider mb-1">🔧 Dev OTP</p>
                    <p className="text-amber-200 text-4xl font-black tracking-[0.4em]">{devOtp}</p>
                  </div>
                )}
                <input {...register('otp',{required:true})}
                  className="w-full py-5 text-4xl font-black text-center text-white tracking-[0.5em] rounded-xl focus:outline-none"
                  style={{ background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.12)' }}
                  placeholder="••••••" inputMode="numeric" maxLength={6} autoFocus />
                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-xl font-black text-lg text-white"
                  style={{ background:'linear-gradient(135deg,#10b981,#059669)', boxShadow:'0 4px 0 #065f46, 0 8px 24px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                  {loading ? '⏳' : '✓ ยืนยัน OTP'}
                </button>
                <button type="button" onClick={() => setStep('phone')}
                  className="w-full py-2 text-blue-400/60 text-sm hover:text-blue-400 transition-colors">← เปลี่ยนเบอร์</button>
              </form>
            )}

            {step === 'register' && (
              <form onSubmit={handleSubmit(onRegister)} className="space-y-4">
                <h2 className="text-xl font-black text-white text-center">สมัครสมาชิก</h2>
                <input {...register('displayName',{required:true,minLength:2})}
                  className="w-full px-4 py-3.5 rounded-xl text-lg font-bold text-white placeholder-white/20 focus:outline-none"
                  style={{ background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.12)' }}
                  placeholder="ชื่อเล่น / ชื่อจริง" autoFocus />
                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-xl font-black text-lg text-white"
                  style={{ background:'linear-gradient(135deg,#a855f7,#7c3aed)', boxShadow:'0 4px 0 #4c1d95, 0 8px 24px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                  {loading ? '⏳' : '✨ สมัครเลย'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-white/10 text-[10px] tracking-widest">© 2024 BOR TOK GOONG · All rights reserved</p>
      </div>
    </div>
  )
}
