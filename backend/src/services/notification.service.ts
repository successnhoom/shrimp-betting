import { prisma } from '../lib/prisma'

type NotifType = 'round_opened' | 'win' | 'lose' | 'deposit' | 'withdraw_approved' | 'refund' | 'system'

interface CreateNotifOpts {
  userId:  string
  type:    NotifType
  title:   string
  body:    string
  data?:   object
}

export async function createNotification(opts: CreateNotifOpts) {
  try {
    return await prisma.notification.create({
      data: {
        userId: opts.userId,
        type:   opts.type,
        title:  opts.title,
        body:   opts.body,
        data:   opts.data ?? undefined,
      },
    })
  } catch (err) {
    // Non-critical — log but don't throw
    console.error('Failed to create notification:', err)
  }
}

export async function notifyRoundOpened(userIds: string[], shopName: string, roundId: string) {
  const notifs = userIds.map(userId =>
    createNotification({
      userId, type: 'round_opened',
      title: `🎯 รอบใหม่เปิดแล้ว — ${shopName}`,
      body:  'กดเข้าไปวางเดิมพันได้เลย!',
      data:  { roundId },
    })
  )
  await Promise.allSettled(notifs)
}

export async function notifyWin(userId: string, amount: number, roundId: string) {
  await createNotification({
    userId, type: 'win',
    title: '🎉 คุณชนะ!',
    body:  `ได้รับ ${amount.toLocaleString('th-TH')} บาท เข้ากระเป๋าแล้ว`,
    data:  { roundId, amount },
  })
}

export async function notifyLose(userId: string, amount: number, roundId: string) {
  await createNotification({
    userId, type: 'lose',
    title: '😔 แพ้รอบนี้',
    body:  `เสีย ${amount.toLocaleString('th-TH')} บาท โชคดีรอบหน้า!`,
    data:  { roundId, amount },
  })
}

export async function notifyDeposit(userId: string, amount: number) {
  await createNotification({
    userId, type: 'deposit',
    title: '💳 เติมเงินสำเร็จ',
    body:  `${amount.toLocaleString('th-TH')} บาท เข้ากระเป๋าแล้ว`,
    data:  { amount },
  })
}

export async function notifyWithdrawApproved(userId: string, amount: number) {
  await createNotification({
    userId, type: 'withdraw_approved',
    title: '✅ อนุมัติถอนเงินแล้ว',
    body:  `${amount.toLocaleString('th-TH')} บาท กำลังโอนเข้าบัญชีของคุณ`,
    data:  { amount },
  })
}

export async function notifyRefund(userId: string, amount: number) {
  await createNotification({
    userId, type: 'refund',
    title: '↩️ คืนเงินแล้ว',
    body:  `${amount.toLocaleString('th-TH')} บาท กลับสู่กระเป๋าของคุณ`,
    data:  { amount },
  })
}
