import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { getWallet, requestWithdraw, addDeposit } from '../services/wallet.service'
import { getPromptPayQRDataUrl } from '../services/promptpay.service'
import { notifyDeposit } from '../jobs/notification.jobs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' })

export async function walletRoutes(app: FastifyInstance) {
  // GET /api/wallet
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const wallet = await getWallet(userId)
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send({
      balance: wallet.balance.toNumber(),
      lockedAmount: wallet.lockedAmount.toNumber(),
      available: wallet.balance.toNumber(),
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toNumber(),
        refId: t.refId,
        note: t.note,
        createdAt: t.createdAt,
      })),
    })
  })

  // POST /api/wallet/deposit  — create Stripe payment intent
  app.post('/deposit', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { amount } = z.object({ amount: z.number().min(20).max(100000) }).parse(request.body)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses satang
      currency: 'thb',
      metadata: { userId, amountThb: amount.toString() },
      description: `Deposit for ${user.phone}`,
    })

    await prisma.paymentIntent.create({
      data: {
        userId,
        stripeIntentId: intent.id,
        amount,
        status: 'pending',
      },
    })

    return reply.send({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
    })
  })

  // POST /api/wallet/withdraw
  app.post('/withdraw', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { amount } = z.object({ amount: z.number().min(100) }).parse(request.body)

    try {
      const tx = await requestWithdraw(userId, amount)
      return reply.send({ message: 'Withdrawal request submitted', transactionId: tx.id, amount })
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_BALANCE') {
        return reply.status(400).send({ error: 'Insufficient balance' })
      }
      throw err
    }
  })

  // POST /api/wallet/deposit/promptpay  — PromptPay QR
  app.post('/deposit/promptpay', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { amount } = z.object({ amount: z.number().min(20).max(100000) }).parse(request.body)
    const shopPhone = process.env.PROMPTPAY_PHONE || '0800000000'

    const qrDataUrl = await getPromptPayQRDataUrl(shopPhone, amount)

    // Create a pending transaction record (staff must confirm manually)
    const pending = await prisma.transaction.create({
      data: { userId, type: 'deposit', amount: 0, note: `PromptPay pending ${amount} THB` },
    })

    return reply.send({ qrDataUrl, amount, pendingId: pending.id, phone: shopPhone })
  })

  // POST /api/wallet/deposit/promptpay/confirm  — Admin confirms PromptPay
  app.post('/deposit/promptpay/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role } = request.user as { role: string }
    if (!['staff', 'admin'].includes(role)) return reply.status(403).send({ error: 'Forbidden' })

    const { userId, amount, note } = z.object({
      userId: z.string(), amount: z.number().min(1), note: z.string().optional(),
    }).parse(request.body)

    await addDeposit(userId, amount, `promptpay-${Date.now()}`)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
    if (user) await notifyDeposit(user.phone, amount)

    return reply.send({ message: 'Deposit confirmed', userId, amount })
  })

  // GET /api/wallet/transactions
  app.get('/transactions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { page = 1, limit = 20 } = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(20),
    }).parse(request.query)

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where: { userId } }),
    ])

    return reply.send({
      data: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toNumber(),
        note: t.note,
        createdAt: t.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  })

  // POST /api/wallet/webhook/stripe  — Stripe webhook
  app.post('/webhook/stripe', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        (request as any).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      )
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' })
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent
      const { userId, amountThb } = intent.metadata

      // Idempotency check
      const existing = await prisma.paymentIntent.findUnique({
        where: { stripeIntentId: intent.id },
      })
      if (existing && existing.status === 'fulfilled') {
        return reply.send({ received: true })
      }

      await prisma.paymentIntent.update({
        where: { stripeIntentId: intent.id },
        data: { status: 'fulfilled', fulfilledAt: new Date() },
      })

      await addDeposit(userId, parseFloat(amountThb), intent.id)
    }

    return reply.send({ received: true })
  })
}
