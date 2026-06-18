import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from './prisma'

/**
 * Ensures the requesting user is allowed to access data scoped to `shopId`.
 * - admin: always allowed (global/platform-owner access across all shops)
 * - staff: must have a ShopStaff row linking their userId to this shopId
 *
 * Sends a 403 and returns false when access is denied. Callers MUST do:
 *   if (!(await assertShopAccess(request, reply, shopId))) return
 * immediately after calling this, so the handler stops executing.
 */
export async function assertShopAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  shopId: string
): Promise<boolean> {
  const { userId, role } = request.user as { userId: string; role: string }

  if (role === 'admin') return true

  const membership = await prisma.shopStaff.findUnique({
    where: { shopId_userId: { shopId, userId } },
  })

  if (!membership) {
    reply.status(403).send({ error: 'You do not have access to this shop' })
    return false
  }

  return true
}
