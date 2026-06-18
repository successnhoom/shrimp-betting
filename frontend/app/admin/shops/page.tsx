'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { TableSkeleton } from '@/components/ui/Skeleton'

export default function AdminShops() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | 'tables' | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ name: '', payoutRate: '0.90', ownerPhone: '' })
  const [tableCount, setTableCount] = useState('5')
  const [loading, setLoading] = useState(false)

  const { data: shops, isLoading } = useQuery({
    queryKey: ['adminShops'],
    queryFn: () => adminApi.getShops().then(r => r.data),
  })

  async function createShop() {
    setLoading(true)
    try {
      await adminApi.createShop({ name: form.name, payoutRate: parseFloat(form.payoutRate), ownerPhone: form.ownerPhone || undefined })
      toast.success('สร้างร้านแล้ว')
      qc.invalidateQueries({ queryKey: ['adminShops'] })
      setModal(null)
      setForm({ name: '', payoutRate: '0.90', ownerPhone: '' })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  async function addTables() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await adminApi.createTables(selected.id, parseInt(tableCount))
      toast.success(`สร้าง ${res.data.length} โต๊ะแล้ว`)
      qc.invalidateQueries({ queryKey: ['adminShops'] })
      setModal(null)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  async function toggleShop(shop: any) {
    await adminApi.updateShop(shop.id, { isActive: !shop.isActive })
    toast.success(shop.isActive ? 'ปิดร้านแล้ว' : 'เปิดร้านแล้ว')
    qc.invalidateQueries({ queryKey: ['adminShops'] })
  }

  async function copyStaffLink(shop: any) {
    const url = `${window.location.origin}/staff/join/${shop.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`คัดลอกลิงก์หลังบ้านร้าน "${shop.name}" แล้ว`)
    } catch {
      toast.error(`คัดลอกไม่ได้ — ลิงก์คือ: ${url}`)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏪 ร้านค้า</h1>
          <p className="text-gray-500 text-sm">จัดการร้านตกกุ้ง</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary text-sm px-4 py-2">
          + เพิ่มร้าน
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={3} /> : (
        <div className="space-y-3">
          {shops?.map((shop: any) => (
            <div key={shop.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{shop.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${shop.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {shop.isActive ? 'เปิด' : 'ปิด'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>👤 {shop.owner?.displayName}</span>
                    <span>🪑 {shop.tableCount} โต๊ะ</span>
                    <span>🎯 {shop.roundCount} รอบ</span>
                    <span>👷 {shop.staffCount} พนักงาน</span>
                    <span>💰 จ่าย {(shop.payoutRate * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono">ID: {shop.id}</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <button onClick={() => copyStaffLink(shop)}
                    className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50">
                    🔗 ลิงก์หลังบ้าน
                  </button>
                  <button onClick={() => { setSelected(shop); setModal('tables') }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">
                    + โต๊ะ
                  </button>
                  <button onClick={() => toggleShop(shop)}
                    className={`px-3 py-1.5 text-sm rounded-xl ${shop.isActive ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                    {shop.isActive ? 'ปิด' : 'เปิด'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create shop modal */}
      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="เพิ่มร้านใหม่">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อร้าน *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input" placeholder="บ่อตกกุ้ง..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อัตราจ่าย (0.50–0.99)</label>
            <input value={form.payoutRate} onChange={e => setForm({ ...form, payoutRate: e.target.value })}
              type="number" step="0.01" min="0.5" max="0.99" className="input" />
            <p className="text-xs text-gray-400 mt-1">ลูกค้าได้รับ {(parseFloat(form.payoutRate || '0') * 100).toFixed(0)}%, ร้านได้ {((1 - parseFloat(form.payoutRate || '0')) * 100).toFixed(0)}%</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรเจ้าของร้าน (optional)</label>
            <input value={form.ownerPhone} onChange={e => setForm({ ...form, ownerPhone: e.target.value })}
              className="input" placeholder="08xxxxxxxx" />
          </div>
          <button onClick={createShop} disabled={loading || !form.name} className="btn-primary w-full mt-2">
            {loading ? 'กำลังสร้าง...' : 'สร้างร้าน'}
          </button>
        </div>
      </Modal>

      {/* Add tables modal */}
      <Modal isOpen={modal === 'tables'} onClose={() => setModal(null)} title={`เพิ่มโต๊ะ — ${selected?.name}`}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">มีอยู่แล้ว {selected?.tableCount} โต๊ะ</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนโต๊ะที่ต้องการเพิ่ม</label>
            <input value={tableCount} onChange={e => setTableCount(e.target.value)}
              type="number" min="1" max="50" className="input" />
          </div>
          <button onClick={addTables} disabled={loading} className="btn-primary w-full">
            {loading ? 'กำลังสร้าง...' : `เพิ่ม ${tableCount} โต๊ะ`}
          </button>
        </div>
      </Modal>
    </div>
  )
}
