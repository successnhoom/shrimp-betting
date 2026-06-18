import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Role, RoundStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'

async function requireAdmin(request: any, reply: any) {
  const { role } = request.user as { role: string }
  if (role !== 'admin') return reply.status(403).send({ error: 'Admin access required' })
}

export async function adminRoutes(app: FastifyInstance) {
  const preHandler = [app.authenticate, requireAdmin]

  // ─── SHOPS ───────────────────────────────────────────────

  // GET /api/admin/shops
  app.get('/shops', { preHandler }, async (request, reply) => {
    const shops = await prisma.shop.findMany({
      include: {
        owner: { select: { id: true, displayName: true, phone: true } },
        _count: { select: { tables: true, rounds: true, staff: true } },
      },
      orderBy: { name: 'asc' },
    })
    return reply.send(shops.map(s => ({
      id: s.id, name: s.name, isActive: s.isActive, payoutRate: s.payoutRate.toNumber(),
      owner: s.owner,
      tableCount: s._count.tables, roundCount: s._count.rounds, staffCount: s._count.staff,
    })))
  })

  // POST /api/admin/shops
  app.post('/shops', { preHandler }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { name, payoutRate, ownerPhone } = z.object({
      name: z.string().min(1),
      payoutRate: z.number().min(0.5).max(0.99).default(0.90),
      ownerPhone: z.string().optional(),
    }).parse(request.body)

    let ownerId = userId
    if (ownerPhone) {
      const owner = await prisma.user.findUnique({ where: { phone: ownerPhone } })
      if (!owner) return reply.status(404).send({ error: 'Owner not found' })
      ownerId = owner.id
    }

    const shop = await prisma.shop.create({ data: { name, payoutRate, ownerId } })
    return reply.status(201).send(shop)
  })

  // PATCH /api/admin/shops/:id
  app.patch('/shops/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = z.object({
      name: z.string().optional(),
      payoutRate: z.number().min(0.5).max(0.99).optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body)
    const shop = await prisma.shop.update({ where: { id }, data })
    return reply.send(shop)
  })

  // POST /api/admin/shops/:id/tables  — generate tables
  app.post('/shops/:id/tables', { preHandler }, async (request, reply) => {
    const { id: shopId } = request.params as { id: string }
    const { count } = z.object({ count: z.number().min(1).max(50) }).parse(request.body)
    const appUrl = process.env.APP_URL || 'http://localhost:3000'

    const existing = await prisma.table.count({ where: { shopId } })
    const tables = []
    for (let i = existing + 1; i <= existing + count; i++) {
      const table = await prisma.table.upsert({
        where: { shopId_tableNumber: { shopId, tableNumber: i } },
        update: {},
        create: {
          shopId, tableNumber: i,
          qrCodeUrl: `${appUrl}/join/${shopId}?table=${i}`,
        },
      })
      tables.push(table)
    }
    return reply.status(201).send(tables)
  })

  // ─── STAFF ───────────────────────────────────────────────

  // GET /api/admin/shops/:id/staff
  app.get('/shops/:id/staff', { preHandler }, async (request, reply) => {
    const { id: shopId } = request.params as { id: string }
    const staff = await prisma.shopStaff.findMany({
      where: { shopId },
      include: { user: { select: { id: true, displayName: true, phone: true, role: true } } },
    })
    return reply.send(staff.map(s => s.user))
  })

  // POST /api/admin/shops/:id/staff  — add staff by phone
  app.post('/shops/:id/staff', { preHandler }, async (request, reply) => {
    const { id: shopId } = request.params as { id: string }
    const { phone } = z.object({ phone: z.string() }).parse(request.body)

    let user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      // Create a new staff account
      user = await prisma.user.create({
        data: { phone, displayName: `Staff ${phone}`, role: Role.staff, wallet: { create: {} } },
      })
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { role: Role.staff } })
    }

    await prisma.shopStaff.upsert({
      where: { shopId_userId: { shopId, userId: user.id } },
      update: {},
      create: { shopId, userId: user.id },
    })

    return reply.status(201).send({ message: 'Staff added', user: { id: user.id, phone: user.phone, displayName: user.displayName } })
  })

  // DELETE /api/admin/shops/:id/staff/:userId
  app.delete('/shops/:id/staff/:userId', { preHandler }, async (request, reply) => {
    const { id: shopId, userId } = request.params as { id: string; userId: string }
    await prisma.shopStaff.delete({ where: { shopId_userId: { shopId, userId } } })
    return reply.send({ message: 'Staff removed' })
  })

  // ─── USERS ───────────────────────────────────────────────

  // GET /api/admin/users
  app.get('/users', { preHandler }, async (request, reply) => {
    const { q, page = 1 } = z.object({ q: z.string().optional(), page: z.coerce.number().default(1) }).parse(request.query)
    const limit = 20
    const where = q ? { OR: [{ phone: { contains: q } }, { displayName: { contains: q, mode: 'insensitive' as const } }] } : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { wallet: { select: { balance: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({
      data: users.map(u => ({
        id: u.id, phone: u.phone, displayName: u.displayName, role: u.role,
        isActive: u.isActive, balance: u.wallet?.balance.toNumber() ?? 0, createdAt: u.createdAt,
      })),
      total, page, totalPages: Math.ceil(total / limit),
    })
  })

  // PATCH /api/admin/users/:id
  app.patch('/users/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = z.object({
      isActive: z.boolean().optional(),
      role: z.enum(['customer', 'staff', 'admin']).optional(),
      displayName: z.string().optional(),
    }).parse(request.body)
    const user = await prisma.user.update({ where: { id }, data })
    return reply.send({ id: user.id, phone: user.phone, role: user.role, isActive: user.isActive })
  })

  // POST /api/admin/users/:id/adjust-balance  — manual credit adjustment
  app.post('/users/:id/adjust-balance', { preHandler }, async (request, reply) => {
    const { userId: adminId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { amount, note } = z.object({ amount: z.number(), note: z.string() }).parse(request.body)

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({ where: { userId: id }, data: { balance: { increment: amount } } })
      await tx.transaction.create({
        data: { userId: id, type: amount > 0 ? 'deposit' : 'withdraw', amount, note: `Admin adjust: ${note}`, refId: adminId },
      })
    })

    return reply.send({ message: 'Balance adjusted', amount })
  })

  // ─── REVENUE ─────────────────────────────────────────────

  // GET /api/admin/revenue  — revenue summary
  app.get('/revenue', { preHandler }, async (request, reply) => {
    const { from, to, shopId } = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      shopId: z.string().optional(),
    }).parse(request.query)

    const startDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30))
    const endDate = to ? new Date(to) : new Date()

    const where = {
      status: RoundStatus.settled,
      settledAt: { gte: startDate, lte: endDate },
      ...(shopId ? { shopId } : {}),
    }

    const rounds = await prisma.round.findMany({
      where,
      include: {
        shop: { select: { name: true } },
        bets: { select: { amountAccepted: true, status: true } },
      },
      orderBy: { settledAt: 'desc' },
    })

    // คำนวณเฉพาะ bet ที่ชนะ/แพ้จริง ไม่รวม refund
    const calcVol = (bets: { amountAccepted: any; status: string }[]) =>
      bets
        .filter(b => b.status === 'won' || b.status === 'lost')
        .reduce((s, b) => s + Number(b.amountAccepted), 0)

    const totalVolume = rounds.reduce((s, r) => s + calcVol(r.bets), 0)
    const shopFee = totalVolume * 0.10
    const totalRounds = rounds.length

    // Group by day
    const byDay: Record<string, { volume: number; rounds: number; fee: number }> = {}
    for (const r of rounds) {
      const day = r.settledAt!.toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { volume: 0, rounds: 0, fee: 0 }
      const vol = calcVol(r.bets)
      byDay[day].volume += vol
      byDay[day].rounds += 1
      byDay[day].fee += vol * 0.10
    }

    return reply.send({
      summary: { totalVolume, shopFee, totalRounds },
      byDay: Object.entries(byDay).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date)),
    })
  })

  // GET /api/admin/revenue/shops  — per-shop breakdown
  app.get('/revenue/shops', { preHandler }, async (request, reply) => {
    const shops = await prisma.shop.findMany({
      include: {
        rounds: {
          where: { status: RoundStatus.settled },
          include: { bets: { select: { amountAccepted: true, status: true } } },
        },
      },
    })
    return reply.send(shops.map(s => {
      const vol = s.rounds.reduce((acc, r) =>
        acc + r.bets
          .filter((b: any) => b.status === 'won' || b.status === 'lost')
          .reduce((bs: number, b: any) => bs + Number(b.amountAccepted), 0)
      , 0)
      return { id: s.id, name: s.name, totalVolume: vol, fee: vol * 0.10, rounds: s.rounds.length }
    }))
  })

  // ─── WITHDRAW MANAGEMENT ─────────────────────────────────

  // GET /api/admin/withdrawals  — all withdraw requests (pending + approved)
  app.get('/withdrawals', { preHandler }, async (request, reply) => {
    const pending = await prisma.transaction.findMany({
      where: {
        type: 'withdraw',
        amount: { lt: 0 },  // only actual deductions (not payouts)
      },
      include: { user: { select: { id: true, phone: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return reply.send(pending.map(t => ({
      id: t.id,
      user: t.user,
      amount: Math.abs(t.amount.toNumber()),
      status: t.note === 'Withdrawal approved' ? 'approved' : 'pending',
      createdAt: t.createdAt,
    })))
  })

  // POST /api/admin/withdrawals/:txId/approve
  app.post('/withdrawals/:txId/approve', { preHandler }, async (request, reply) => {
    const { txId } = request.params as { txId: string }
    await prisma.transaction.update({
      where: { id: txId },
      data: { note: 'Withdrawal approved' },
    })
    return reply.send({ message: 'Approved' })
  })

  // ─── CSV EXPORT ───────────────────────────────────────────

  // GET /api/admin/revenue/export?from=&to=
  app.get('/revenue/export', { preHandler }, async (request, reply) => {
    const { from, to, shopId } = z.object({
      from:   z.string().optional(),
      to:     z.string().optional(),
      shopId: z.string().optional(),
    }).parse(request.query)

    const startDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30))
    const endDate   = to   ? new Date(to)   : new Date()

    const rounds = await prisma.round.findMany({
      where: {
        status: 'settled',
        settledAt: { gte: startDate, lte: endDate },
        ...(shopId ? { shopId } : {}),
      },
      include: {
        shop:  { select: { name: true } },
        staff: { select: { displayName: true } },
        bets:  { select: { side: true, amountAccepted: true, payout: true, status: true } },
      },
      orderBy: { settledAt: 'asc' },
    })

    // Build CSV
    const header = 'วันที่,ร้าน,รอบ ID,ผล,ยอดคู่,ยอดคี่,ยอดรวม,รายได้ร้าน 10%,จำนวนผู้แทง,พนักงาน'
    const rows = rounds.map(r => {
      const even = r.totalEven.toNumber()
      const odd  = r.totalOdd.toNumber()
      const vol  = even + odd
      return [
        r.settledAt?.toISOString().replace('T', ' ').slice(0, 19),
        r.shop.name,
        r.id.slice(-8),
        r.result === 'even' ? 'คู่' : 'คี่',
        even, odd, vol,
        (vol * 0.10).toFixed(2),
        r.bets.length,
        r.staff.displayName,
      ].join(',')
    })

    const csv = '﻿' + [header, ...rows].join('\n') // BOM for Thai Excel
    const filename = `revenue_${startDate.toISOString().slice(0,10)}_${endDate.toISOString().slice(0,10)}.csv`

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv)
  })
}
