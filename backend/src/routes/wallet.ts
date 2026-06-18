import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { getWallet, requestWithdraw, addDeposit } from '../services/wallet.service'
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
      available: wallet.balance.toNumber() - wallet.lockedAmount.toNumber(),
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

  // POST /api/wallet/deposit/promptpay — Stripe PromptPay QR (auto)
  app.post('/deposit/promptpay', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { amount } = z.object({ amount: z.number().min(20).max(100000) }).parse(request.body)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    // Create PaymentIntent with PromptPay
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // satang
      currency: 'thb',
      payment_method_types: ['promptpay'],
      metadata: { userId, amountThb: amount.toString() },
      description: `Deposit ${amount} THB — ${user.phone}`,
    })

    // Confirm immediately to get QR code
    const confirmed = await stripe.paymentIntents.confirm(intent.id, {
      payment_method: { type: 'promptpay' } as any,
    })

    // Save to DB for idempotency
    await prisma.paymentIntent.create({
      data: {
        userId,
        stripeIntentId: confirmed.id,
        amount,
        status: 'pending',
      },
    })

    // Extract QR code from next_action
    const qrAction = (confirmed.next_action as any)?.promptpay_display_qr_code
    const qrImageUrl = qrAction?.image_url_png || qrAction?.image_url_svg || null
    const qrData = qrAction?.data || null

    return reply.send({
      paymentIntentId: confirmed.id,
      amount,
      qrImageUrl,   // PNG image URL from Stripe CDN
      qrData,       // Raw PromptPay string (for generating own QR if needed)
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
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

  // POST /api/wallet/webhook/stripe — auto credit on payment
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
      if (existing?.status === 'fulfilled') {
        return reply.send({ received: true })
      }

      await prisma.paymentIntent.update({
        where: { stripeIntentId: intent.id },
        data: { status: 'fulfilled', fulfilledAt: new Date() },
      })

      await addDeposit(userId, parseFloat(amountThb), intent.id)

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
      if (user) await notifyDeposit(user.phone, parseFloat(amountThb))
    }

    return reply.send({ received: true })
  })
}
