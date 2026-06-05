import { Queue, Worker, Job } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

export const notificationQueue = new Queue('notifications', { connection })

async function processNotification(job: Job) {
  const { type, phone, message } = job.data

  if (process.env.NODE_ENV === 'development') {
    console.log(`📱 [SMS] → ${phone}: ${message}`)
    return
  }

  if (type === 'sms') {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    await twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+66${phone.replace(/^0/, '')}`,
    })
  }
}

export const notificationWorker = new Worker('notifications', processNotification, { connection })

notificationWorker.on('failed', (job, err) => {
  console.error(`Notification job ${job?.id} failed:`, err.message)
})

// Send win notification
export async function notifyWinner(phone: string, amount: number, roundId: string) {
  await notificationQueue.add('sms', {
    type: 'sms',
    phone,
    message: `🎉 คุณชนะ! ได้รับ ${amount.toLocaleString('th-TH')} บาท (รอบ ${roundId.slice(-6)}) ระบบโอนเข้ากระเป๋าแล้ว`,
  }, { removeOnComplete: true })
}

// Send deposit confirmation
export async function notifyDeposit(phone: string, amount: number) {
  await notificationQueue.add('sms', {
    type: 'sms',
    phone,
    message: `✅ เติมเงินสำเร็จ ${amount.toLocaleString('th-TH')} บาท เข้ากระเป๋าแล้ว`,
  }, { removeOnComplete: true })
}
