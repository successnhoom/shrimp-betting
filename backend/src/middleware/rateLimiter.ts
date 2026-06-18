import { FastifyRequest, FastifyReply } from 'fastify'
import { redis } from '../lib/redis'

/**
 * Per-user rate limiter using Redis
 * More granular than the global plugin-level limiter
 */
export function userRateLimit(maxRequests: number, windowSeconds: number, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as { userId: string } | undefined
    if (!user) return // unauthenticated requests use global limiter

    const key = `rl:${action}:${user.userId}`
    const current = await redis.incr(key)

    if (current === 1) {
      await redis.expire(key, windowSeconds)
    }

    if (current > maxRequests) {
      const ttl = await redis.ttl(key)
      return reply.status(429).send({
        error: 'Too many requests',
        retryAfter: ttl,
        message: `ทำรายการบ่อยเกินไป กรุณารอ ${ttl} วินาที`,
      })
    }

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests)
    reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - current))
  }
}

// Preset limiters
export const betRateLimit = userRateLimit(10, 60, 'bet')       // 10 bets/min
export const otpRateLimit = userRateLimit(3, 300, 'otp')       // 3 OTPs/5min
export const depositRateLimit = userRateLimit(5, 60, 'deposit') // 5 deposits/min
