import { Queue, Worker, Job } from 'bullmq'
import { redis } from '../lib/redis'
import { lockRound, settleRound } from '../services/round.service'
import { prisma } from '../lib/prisma'

import IORedis from 'ioredis'
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })

// Queue for scheduled round locks
export const roundQueue = new Queue('rounds', { connection })

// Job: auto-lock round after duration
async function processRoundJob(job: Job) {
  const { type, roundId, shopId, result } = job.data

  if (type === 'lock') {
    console.log(`🔒 Auto-locking round ${roundId}`)
    await lockRound(roundId, shopId)
  }

  if (type === 'settle') {
    // Only if staff hasn't manually settled
    const round = await prisma.round.findUnique({ where: { id: roundId } })
    if (round && round.status === 'locked') {
      console.log(`⏰ Auto-settle round ${roundId} with result ${result}`)
      // Note: Auto-settle is disabled by default. Staff must settle manually.
      // Uncomment to enable:
      // await settleRound(roundId, result, shopId)
    }
  }
}

export const roundWorker = new Worker('rounds', processRoundJob, { connection })

roundWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`)
})

roundWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
})

// Schedule auto-lock for a round
export async function scheduleRoundLock(roundId: string, shopId: string, delayMs: number) {
  await roundQueue.add(
    'lock-round',
    { type: 'lock', roundId, shopId },
    { delay: delayMs, removeOnComplete: true, removeOnFail: 100, jobId: `lock-${roundId}` }
  )
}

// Cancel scheduled lock (when staff manually closes early)
export async function cancelScheduledLock(roundId: string) {
  const job = await roundQueue.getJob(`lock-${roundId}`)
  if (job) await job.remove()
}
