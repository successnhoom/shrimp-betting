import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

/**
 * Audit log for sensitive admin actions
 */
export async function auditLog(
  userId: string,
  action: string,
  target: string,
  details?: object
) {
  // Log to console + store in DB notes via transaction
  console.log(`[AUDIT] ${new Date().toISOString()} | ${userId} | ${action} | ${target}`, details || '')

  // Store lightweight audit record in transaction table with special type
  try {
    await prisma.transaction.create({
      data: {
        userId,
        type: 'shop_fee', // reuse as audit marker
        amount: 0,
        note: `AUDIT:${action}:${target}:${JSON.stringify(details || {})}`.slice(0, 500),
      },
    })
  } catch {
    // Non-critical — don't block the main operation
  }
}

/**
 * Hook to log sensitive admin route calls
 */
export function withAudit(action: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = (request as any).user as { userId: string }
    const params = (request as any).params || {}
    await auditLog(user.userId, action, JSON.stringify(params), request.body as object || {})
  }
}
