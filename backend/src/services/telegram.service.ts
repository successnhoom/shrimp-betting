const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID   = process.env.TELEGRAM_ADMIN_CHAT_ID || ''
const BASE      = `https://api.telegram.org/bot${BOT_TOKEN}`

export function isTelegramConfigured() {
  return !!BOT_TOKEN && !!CHAT_ID
}

/** Send deposit notification with slip image + approve/reject buttons */
export async function sendDepositNotification(opts: {
  requestId: string
  userPhone: string
  displayName: string
  amount: number
  slipBase64?: string  // base64 encoded image
  slipMime?: string    // image/jpeg or image/png
}): Promise<number | null> {
  if (!isTelegramConfigured()) {
    console.log(`📱 [Telegram] SKIP — not configured. Deposit ${opts.requestId} = ${opts.amount} THB`)
    return null
  }

  const keyboard = {
    inline_keyboard: [[
      { text: `✅ อนุมัติ ${opts.amount.toLocaleString()} ฿`, callback_data: `approve:${opts.requestId}` },
      { text: '❌ ปฏิเสธ', callback_data: `reject:${opts.requestId}` },
    ]],
  }

  const caption =
    `💰 *คำขอเติมเงิน*\n\n` +
    `👤 ${opts.displayName} (${opts.userPhone})\n` +
    `💵 จำนวน: *${opts.amount.toLocaleString()} ฿*\n` +
    `🆔 ID: \`${opts.requestId.slice(0, 8)}\``

  try {
    let res: Response
    let data: any

    if (opts.slipBase64 && opts.slipMime) {
      // Send photo with inline buttons
      const buf    = Buffer.from(opts.slipBase64, 'base64')
      const blob   = new Blob([buf], { type: opts.slipMime })
      const form   = new FormData()
      form.append('chat_id',      CHAT_ID)
      form.append('photo',        blob, 'slip.jpg')
      form.append('caption',      caption)
      form.append('parse_mode',   'Markdown')
      form.append('reply_markup', JSON.stringify(keyboard))

      res  = await fetch(`${BASE}/sendPhoto`, { method: 'POST', body: form })
      data = await res.json()
    } else {
      // Text only
      res  = await fetch(`${BASE}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:      CHAT_ID,
          text:         caption,
          parse_mode:   'Markdown',
          reply_markup: keyboard,
        }),
      })
      data = await res.json()
    }

    if (!data.ok) {
      console.error('[Telegram] sendDepositNotification failed:', data)
      return null
    }
    return data.result?.message_id ?? null
  } catch (err) {
    console.error('[Telegram] error:', err)
    return null
  }
}

/** Edit the message after admin approves/rejects */
export async function updateDepositMessage(
  msgId: number,
  status: 'approved' | 'rejected',
  amount: number,
  byName?: string,
) {
  if (!isTelegramConfigured()) return
  const emoji = status === 'approved' ? '✅' : '❌'
  const label = status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'
  const text  =
    `${emoji} *${label}*\n\n` +
    `💵 ${amount.toLocaleString()} ฿\n` +
    (byName ? `👤 by ${byName}` : '')

  await fetch(`${BASE}/editMessageText`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    CHAT_ID,
      message_id: msgId,
      text,
      parse_mode: 'Markdown',
    }),
  }).catch(() => {})
}

/** Answer callback query (removes loading spinner in Telegram) */
export async function answerCallback(callbackQueryId: string, text: string) {
  if (!isTelegramConfigured()) return
  await fetch(`${BASE}/answerCallbackQuery`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {})
}

/** Register webhook URL with Telegram */
export async function setWebhook(webhookUrl: string) {
  const res  = await fetch(`${BASE}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })
  return res.json()
}
