'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'
import dayjs from 'dayjs'

export default function AdminWithdrawals() {
  const qc = useQueryClient()

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['withdrawals'],
    queryFn: () => adminApi.getWithdrawals().then(r => r.data),
    refetchInterval: 30_000,
  })

  async function approve(txId: string) {
    await adminApi.approveWithdrawal(txId)
    toast.success('อนุมัติแล้ว')
    qc.invalidateQueries({ queryKey: ['withdrawals'] })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">💸 คำขอถอนเงิน</h1>
        {withdrawals?.length > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium">
            {withdrawals.length} รายการ
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">กำลังโหลด...</div>
      ) : !withdrawals?.length ? (
        <div className="card text-center py-10 text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <p>ไม่มีรายการรอดำเนินการ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w: any) => (
            <div key={w.id} className="card flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">{w.user.displayName}</p>
                <p className="text-sm text-gray-500">{w.user.phone}</p>
                <p className="text-xs text-gray-400 mt-1">{dayjs(w.createdAt).format('DD/MM/YYYY HH:mm')}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-red-600">{w.amount.toLocaleString()} ฿</p>
                <button onClick={() => approve(w.id)}
                  className="mt-1 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl">
                  ✓ อนุมัติ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
