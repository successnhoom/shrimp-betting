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

export type PayinPool = {
  bankCode:      string
  bankName:      string
  accountName:   string
  accountNumber: string
}

/** สร้างรายการฝากเงิน — รองรับทั้ง QR provider (qrCode) และ Transfer/Pool provider (pool) */
export async function createPayin(opts: {
  merchantOrderId: string
  amount: number
  callbackUrl: string
  customerName?: string
  customerPhone?: string
}): Promise<{
  orderId: string
  paymentType: string       // 'qr' | 'transfer'
  qrCode: string | null     // QR provider
  paymentUrl: string | null // QR provider
  pool: PayinPool | null    // Transfer/Pool provider
  expiryMinutes: number
  expiredAt: string
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
  console.log('[CubixPay createPayin] status:', res.status, 'body:', JSON.stringify(data))
  if (!data.success) {
    throw new Error(data.message || `CubixPay createPayin failed (${data.error_code || res.status})`)
  }

  const d = data.data
  const rawPool = d.pool || null
  return {
    orderId:       d.orderId,
    paymentType:   d.paymentType   || 'qr',
    qrCode:        d.qrCode        || null,
    paymentUrl:    d.paymentUrl    || null,
    expiryMinutes: d.expiryMinutes || 15,
    expiredAt:     d.expiredAt,
    pool: rawPool ? {
      bankCode:      rawPool.bankCode    || '',
      bankName:      rawPool.bankName    || '',
      accountName:   rawPool.accountName || '',
      accountNumber: rawPool.accountNumber || '',
    } : null,
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

/**
 * Verify webhook signature จาก CubixPay
 * Algorithm: SHA256(order_id + amount + status + callback_secret)
 * Docs: https://merchant.cubixpay.co/pages/api-docs#overview
 */
export function verifyWebhookSignature(
  orderId: string,
  amount: number | string,
  status: string,
  signature: string,
): boolean {
  const secret = process.env.CUBIXPAY_WEBHOOK_SECRET || ''
  if (!secret) {
    console.error('❌ CUBIXPAY_WEBHOOK_SECRET not set — rejecting webhook request')
    return false
  }
  const expected = crypto.createHash('sha256')
    .update(`${orderId}${amount}${status}${secret}`)
    .digest('hex')
  return expected === signature
}
