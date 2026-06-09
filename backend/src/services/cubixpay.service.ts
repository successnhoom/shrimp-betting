import crypto from 'crypto'

const API_KEY    = process.env.CUBIXPAY_API_KEY    || ''
const SECRET_KEY = process.env.CUBIXPAY_SECRET_KEY || ''
const BASE       = 'https://api.cubixpay.co/v1'

export function isCubixPayConfigured() {
  return !!API_KEY && !!SECRET_KEY
}

/** สร้าง HMAC-SHA256 signature สำหรับ Payout */
function makeSignature(body: Record<string, any>, timestamp: number): string {
  const data = { ...body, timestamp }
  const sorted = Object.keys(data)
    .sort()
    .reduce((acc, k) => { acc[k] = data[k]; return acc }, {} as any)
  const signString = new URLSearchParams(sorted).toString()
  return crypto.createHmac('sha256', SECRET_KEY).update(signString).digest('hex')
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
  const res = await fetch(`${BASE}/payin/create.php`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key':    API_KEY,
    },
    body: JSON.stringify({
      merchantOrderId: opts.merchantOrderId,
      amount:          opts.amount,
      callbackUrl:     opts.callbackUrl,
      customerName:    opts.customerName,
      customerPhone:   opts.customerPhone,
    }),
  })

  const data = await res.json()
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
  const res = await fetch(
    `${BASE}/payin/status.php?merchantOrderId=${encodeURIComponent(merchantOrderId)}`,
    { headers: { 'X-API-Key': API_KEY } }
  )
  const data = await res.json()
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
      'X-API-Key':    API_KEY,
      'X-Timestamp':  String(timestamp),
      'X-Signature':  signature,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'CubixPay createPayout failed')
  return { orderId: data.data.orderId, status: data.data.status }
}

/** Verify webhook signature จาก CubixPay callback */
export function verifyWebhookSignature(payload: {
  order_id: string
  amount: number | string
  status: string
  signature: string
}): boolean {
  const expected = crypto
    .createHash('sha256')
    .update(`${payload.order_id}${payload.amount}${payload.status}${SECRET_KEY}`)
    .digest('hex')
  return expected === payload.signature
}
