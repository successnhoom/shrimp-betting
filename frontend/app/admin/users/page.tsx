'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { TableSkeleton } from '@/components/ui/Skeleton'

export default function AdminUsers() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [editModal, setEditModal]     = useState(false)
  const [adjustModal, setAdjustModal] = useState(false)
  const [editForm, setEditForm]       = useState({ displayName: '' })
  const [adjustForm, setAdjustForm]   = useState({ amount: '', note: '' })
  const [loading, setLoading]         = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', q, page],
    queryFn:  () => adminApi.getUsers(q, page).then(r => r.data),
    placeholderData: (prev) => prev,
  })

  async function toggleUser(user: any) {
    await adminApi.updateUser(user.id, { isActive: !user.isActive })
    toast.success(user.isActive ? 'ปิดบัญชีแล้ว' : 'เปิดบัญชีแล้ว')
    qc.invalidateQueries({ queryKey: ['adminUsers'] })
  }

  async function saveEdit() {
    if (!selected || !editForm.displayName.trim()) return
    setLoading(true)
    try {
      await adminApi.updateUser(selected.id, { displayName: editForm.displayName.trim() })
      toast.success('แก้ไขชื่อแล้ว')
      qc.invalidateQueries({ queryKey: ['adminUsers'] })
      setEditModal(false)
    } catch { toast.error('ไม่สำเร็จ') }
    finally { setLoading(false) }
  }

  async function adjustBalance() {
    if (!selected) return
    const amount = parseFloat(adjustForm.amount)
    if (isNaN(amount) || amount === 0) return toast.error('กรุณากรอกจำนวน')
    if (!adjustForm.note.trim()) return toast.error('กรุณากรอกหมายเหตุ')
    setLoading(true)
    try {
      await adminApi.adjustBalance(selected.id, amount, adjustForm.note)
      toast.success(`${amount > 0 ? 'เพิ่ม' : 'หัก'} ${Math.abs(amount).toLocaleString()} ฿ แล้ว`)
      qc.invalidateQueries({ queryKey: ['adminUsers'] })
      setAdjustModal(false)
      setAdjustForm({ amount: '', note: '' })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  async function confirmDeposit(user: any) {
    const amtStr = prompt(`ยืนยันเติมเงิน PromptPay\nสมาชิก: ${user.displayName}\nกรอกจำนวน (บาท):`)
    if (!amtStr) return
    const amt = parseFloat(amtStr)
    if (isNaN(amt) || amt <= 0) return toast.error('จำนวนไม่ถูกต้อง')
    try {
      await adminApi.confirmDeposit(user.id, amt)
      toast.success(`เติม ${amt.toLocaleString()} ฿ ให้ ${user.displayName} แล้ว`)
      qc.invalidateQueries({ queryKey: ['adminUsers'] })
    } catch { toast.error('ไม่สำเร็จ') }
  }

  const openEdit = (user: any) => {
    setSelected(user)
    setEditForm({ displayName: user.displayName })
    setEditModal(true)
  }

  const openAdjust = (user: any) => {
    setSelected(user)
    setAdjustForm({ amount: '', note: '' })
    setAdjustModal(true)
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold">👥 สมาชิก</h1>

      {/* Search */}
      <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
        className="input max-w-sm" placeholder="🔍 ค้นหาชื่อหรือเบอร์โทร" />

      {isLoading ? <TableSkeleton /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 text-xs">
                <th className="pb-3 font-medium">ชื่อ</th>
                <th className="pb-3 font-medium">เบอร์</th>
                <th className="pb-3 font-medium text-right">เครดิต</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">สถานะ</th>
                <th className="pb-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((u: any) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 font-medium">{u.displayName}</td>
                  <td className="py-3 text-gray-500 tabular-nums">{u.phone}</td>
                  <td className="py-3 text-right font-semibold tabular-nums">{u.balance.toLocaleString()} ฿</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-red-100 text-red-600' :
                      u.role === 'staff' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>{u.isActive ? 'ใช้งาน' : 'ปิด'}</span>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {/* Edit name */}
                      <button onClick={() => openEdit(u)}
                        className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-200">
                        ✏️ แก้ชื่อ
                      </button>
                      {/* Confirm PromptPay */}
                      <button onClick={() => confirmDeposit(u)}
                        className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200">
                        💚 เติม
                      </button>
                      {/* Adjust balance */}
                      <button onClick={() => openAdjust(u)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200">
                        💰 ปรับ
                      </button>
                      {/* Toggle active */}
                      <button onClick={() => toggleUser(u)}
                        className={`px-2 py-1 text-xs rounded-lg border ${
                          u.isActive
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        }`}>
                        {u.isActive ? '🚫 ปิด' : '✅ เปิด'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-400">รวม {data.total} สมาชิก</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40">←</button>
                <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data.totalPages}</span>
                <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40">→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit name modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)}
        title={`✏️ แก้ไขชื่อ — ${selected?.phone}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อที่แสดง</label>
            <input value={editForm.displayName}
              onChange={e => setEditForm({ displayName: e.target.value })}
              className="input" placeholder="ชื่อใหม่"
              onKeyDown={e => e.key === 'Enter' && saveEdit()} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
            <button onClick={saveEdit} disabled={loading || !editForm.displayName.trim()}
              className="btn-primary flex-1">
              {loading ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Adjust balance modal */}
      <Modal isOpen={adjustModal} onClose={() => setAdjustModal(false)}
        title={`💰 ปรับเครดิต — ${selected?.displayName}`}>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-sm">เครดิตปัจจุบัน</p>
            <p className="text-2xl font-bold text-gray-900">{selected?.balance?.toLocaleString()} ฿</p>
          </div>

          {/* Quick add buttons */}
          <div>
            <p className="text-xs text-gray-500 mb-2">เติมด่วน</p>
            <div className="flex gap-2 flex-wrap">
              {[100, 200, 500, 1000, 2000].map(a => (
                <button key={a} onClick={() => setAdjustForm(f => ({ ...f, amount: a.toString() }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    adjustForm.amount === a.toString()
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}>
                  +{a.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              จำนวน <span className="text-gray-400 font-normal">(ใส่ - เพื่อหัก เช่น -100)</span>
            </label>
            <div className="relative">
              <input value={adjustForm.amount}
                onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                type="number" className="input pr-10" placeholder="+500 หรือ -200" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ *</label>
            <input value={adjustForm.note}
              onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))}
              className="input" placeholder="เช่น: เติมเงินสด, แก้ไขยอด, ฯลฯ" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setAdjustModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
            <button onClick={adjustBalance}
              disabled={loading || !adjustForm.amount || !adjustForm.note.trim()}
              className={`flex-1 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${
                parseFloat(adjustForm.amount) < 0
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
              {loading ? 'กำลังบันทึก...' : parseFloat(adjustForm.amount) < 0
                ? `หัก ${Math.abs(parseFloat(adjustForm.amount || '0')).toLocaleString()} ฿`
                : `เพิ่ม ${parseFloat(adjustForm.amount || '0').toLocaleString()} ฿`
              }
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
