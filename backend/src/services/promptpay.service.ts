/**
 * PromptPay QR Code Generator (EMV QR standard)
 * รองรับ PromptPay by phone number or national ID
 */

function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, '0')
}

function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0')
  return `${tag}${length}${value}`
}

function formatPhone(phone: string): string {
  // Normalize to 0066XXXXXXXXX
  const cleaned = phone.replace(/\D/g, '').replace(/^0/, '')
  return `0066${cleaned}`
}

export function generatePromptPayQR(phone: string, amount?: number): string {
  const merchantAccountInfo = tlv('00', 'A000000677010111') + tlv('01', formatPhone(phone))
  const payload = [
    tlv('00', '01'),                                    // Payload Format Indicator
    tlv('01', amount ? '12' : '11'),                    // Point of Initiation Method
    tlv('29', merchantAccountInfo),                      // Merchant Account Info
    tlv('53', '764'),                                   // Transaction Currency (THB)
    ...(amount ? [tlv('54', amount.toFixed(2))] : []),  // Amount (optional)
    tlv('58', 'TH'),                                    // Country Code
    tlv('59', 'NA'),                                    // Merchant Name
    tlv('60', 'Bangkok'),                               // Merchant City
    '6304',                                              // CRC placeholder
  ].join('')

  const checksum = crc16(payload)
  return payload.slice(0, -4) + '6304' + checksum
}

export function getPromptPayQRDataUrl(phone: string, amount?: number): Promise<string> {
  const QRCode = require('qrcode')
  const qrString = generatePromptPayQR(phone, amount)
  return QRCode.toDataURL(qrString, { width: 300, margin: 1 })
}
