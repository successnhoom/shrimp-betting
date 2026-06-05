'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'

export default function AdminStaff() {
  const qc = useQueryClient()
  const [selectedShopId, setSelectedShopId] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: shops } = useQuery({
    queryKey: ['adminShops'],
    queryFn: () => adminApi.getShops().then(r => r.data),
  })

  const { data: staff } = useQuery({
    queryKey: ['adminStaff', selectedShopId],
    queryFn: () => adminApi.getStaff(selectedShopId).then(r => r.data),
    enabled: !!selectedShopId,
  })

  async function addStaff() {
    if (!selectedShopId || !phone) return
    setLoading(true)
    try {
      await adminApi.addStaff(selectedShopId, phone)
      toast.success('เพิ่มพนักงานแล้ว')
      qc.invalidateQueries({ queryKey: ['adminStaff', selectedShopId] })
      setModal(false); setPhone('')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  async function removeStaff(userId: string) {
    if (!confirm('ลบพนักงานออกจากร้านนี้?')) return
    await adminApi.removeStaff(selectedShopId, userId)
    toast.success('ลบแล้ว')
    qc.invalidateQueries({ queryKey: ['adminStaff', selectedShopId] })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">👷 พนักงาน</h1>
        {selectedShopId && (
          <button onClick={() => setModal(true)} className="btn-primary text-sm px-4 py-2">
            + เพิ่มพนักงาน
          </button>
        )}
      </div>

      {/* Shop selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">เลือกร้าน</label>
        <select value={selectedShopId} onChange={e => setSelectedShopId(e.target.value)} className="input">
          <option value="">-- เลือกร้าน --</option>
          {shops?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Staff list */}
      {staff && (
        <div className="card">
          <h3 className="font-bold mb-3">รายชื่อพนักงาน ({staff.length} คน)</h3>
          {staff.length === 0 ? (
            <p className="text-gray-400 text-center py-4">ยังไม่มีพนักงาน</p>
          ) : (
            <div className="space-y-2">
              {staff.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-sm text-gray-500">{u.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{u.role}</span>
                    <button onClick={() => removeStaff(u.id)}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1">
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="เพิ่มพนักงาน">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรพนักงาน</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="input" placeholder="08xxxxxxxx" inputMode="tel" />
            <p className="text-xs text-gray-400 mt-1">ถ้าไม่มีบัญชีจะสร้างให้อัตโนมัติ</p>
          </div>
          <button onClick={addStaff} disabled={loading || !phone} className="btn-primary w-full">
            {loading ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงาน'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
