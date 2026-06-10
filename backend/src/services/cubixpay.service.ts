import crypto from 'crypto'

const BASE = 'https://api.cubixpay.co/v1'

function getKeys() {
  return {
    apiKey:    process.env.CUBIXPAY_API_KEY    || '',
    secretKey: process.env.CUBIXPAY_SECRET_KEY || '',
  }
}

export function isCubixPayConfigured() {
  const { apiKey, secretKey } = getKeys()
  return !!apiKey && !!secretKey
}

/** สร้าง HMAC-SHA256 signature สำหรับ Payout */
function makeSignature(body: Record<string, any>, timestamp: number): string {
  const { secretKey } = getKeys()
  const data = { ...body, timestamp }
  const sorted = Object.keys(data)
    .sort()
    .reduce((acc, k) => { acc[k] = data[k]; return acc }, {} as any)
  const signString = new URLSearchParams(sorted).toString()
  return crypto.createHmac('sha256', secretKey).update(signString).digest('hex')
}

/** สร้าง QR PromptPay สำหรับลูกค้าเติมเงิน */
export async function createPayin(opts: {
  merchantOrderId: string
  amount: number
  callbackUrl: string
  customerName?: string
  customerPhone?: string
}): Promise<{
  orderId: string
  qrCode: string | null
  paymentUrl: string | null
  expiryMinutes: number
  expiredAt: string
  paymentType: string
}> {
  const { apiKey } = getKeys()
  const res = await fetch(`${BASE}/payin/create.php`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key':    apiKey,
    },
    body: JSON.stringify({
      merchantOrderId: opts.merchantOrderId,
      amount:          opts.amount,
      callbackUrl:     opts.callbackUrl,
      customerName:    opts.customerName,
      customerPhone:   opts.customerPhone,
    }),
  })

  const data = await res.json() as any
  if (!data.success) {
    throw new Error(data.message || 'CubixPay createPayin failed')
  }

  return {
    orderId:       data.data.orderId,
    qrCode:        data.data.qrCode        || null,
    paymentUrl:    data.data.paymentUrl    || null,
    expiryMinutes: data.data.expiryMinutes || 15,
    expiredAt:     data.data.expiredAt,
    paymentType:   data.data.paymentType   || 'qr',
  }
}

/** เช็คสถานะ payin */
export async function getPayinStatus(merchantOrderId: string): Promise<{
  status: 'pending' | 'success' | 'failed' | 'expired'
  amount: number
  fee: number
  netAmount: number
  completedAt: string | null
}> {
  const { apiKey } = getKeys()
  const res = await fetch(
    `${BASE}/payin/status.php?merchantOrderId=${encodeURIComponent(merchantOrderId)}`,
    { headers: { 'X-API-Key': apiKey } }
  )
  const data = await res.json() as any
  if (!data.success) throw new Error(data.message || 'CubixPay status failed')

  return {
    status:      data.data.status,
    amount:      data.data.amount,
    fee:         data.data.fee,
    netAmount:   data.data.netAmount,
    completedAt: data.data.completedAt || null,
  }
}

/** สร้าง Payout (ถอนเงินไปบัญชีธนาคาร) */
export async function createPayout(opts: {
  merchantOrderId: string
  amount: number
  bankCode: string
  accountNumber: string
  accountName: string
  callbackUrl: string
}): Promise<{ orderId: string; status: string }> {
  const { apiKey } = getKeys()
  const timestamp = Math.floor(Date.now() / 1000)
  const body = {
    merchantOrderId: opts.merchantOrderId,
    amount:          opts.amount,
    bankCode:        opts.bankCode,
    accountNumber:   opts.accountNumber,
    accountName:     opts.accountName,
    callbackUrl:     opts.callbackUrl,
  }
  const signature = makeSignature(body, timestamp)

  const res = await fetch(`${BASE}/payout/create.php`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key':    apiKey,
      'X-Timestamp':  String(timestamp),
      'X-Signature':  signature,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as any
  if (!data.success) throw new Error(data.message || 'CubixPay createPayout failed')
  return { orderId: data.data.orderId, status: data.data.status }
}

/** Verify webhook signature จาก CubixPay — X-Signature header (HMAC-SHA256 of raw body) */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.CUBIXPAY_WEBHOOK_SECRET || ''
  if (!secret) {
    console.warn('⚠️ CUBIXPAY_WEBHOOK_SECRET not set — skipping signature check')
    return true
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return expected === signature
}
