import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})

// OTP helpers
export const OTP_PREFIX = 'otp:'
export const SESSION_PREFIX = 'session:'

export async function setOtp(phone: string, code: string, expirySeconds: number) {
  await redis.set(`${OTP_PREFIX}${phone}`, code, 'EX', expirySeconds)
}

export async function getOtp(phone: string): Promise<string | null> {
  return redis.get(`${OTP_PREFIX}${phone}`)
}

export async function deleteOtp(phone: string) {
  await redis.del(`${OTP_PREFIX}${phone}`)
}

// Round state helpers (cache live odds)
export async function setRoundOdds(roundId: string, even: string, odd: string) {
  await redis.hset(`round:${roundId}:odds`, { even, odd })
  await redis.expire(`round:${roundId}:odds`, 3600)
}

export async function getRoundOdds(roundId: string) {
  return redis.hgetall(`round:${roundId}:odds`)
}
