import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import QRCode from 'qrcode'
import { prisma } from '../lib/prisma'

export async function qrRoutes(app: FastifyInstance) {
  // GET /api/qr/table/:tableId  — returns QR as SVG
  app.get('/table/:tableId', async (request, reply) => {
    const { tableId } = request.params as { tableId: string }
    const { format = 'svg' } = z.object({ format: z.enum(['svg', 'png', 'dataurl']).default('svg') }).parse(request.query)

    const table = await prisma.table.findUniqueOrThrow({
      where: { id: tableId },
      include: { shop: { select: { name: true } } },
    })

    const url = table.qrCodeUrl || `${process.env.APP_URL || 'http://localhost:3000'}/join/${table.shopId}?table=${table.tableNumber}`

    if (format === 'png') {
      const buffer = await QRCode.toBuffer(url, { width: 512, margin: 2 })
      return reply.header('Content-Type', 'image/png').send(buffer)
    }

    if (format === 'dataurl') {
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 })
      return reply.send({ dataUrl, url, tableNumber: table.tableNumber, shopName: table.shop.name })
    }

    // SVG
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2 })
    return reply.header('Content-Type', 'image/svg+xml').send(svg)
  })

  // GET /api/qr/shop/:shopId/all  — all tables as data URLs for printing
  app.get('/shop/:shopId/all', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const appUrl = process.env.APP_URL || 'http://localhost:3000'

    const tables = await prisma.table.findMany({
      where: { shopId },
      include: { shop: { select: { name: true } } },
      orderBy: { tableNumber: 'asc' },
    })

    const result = await Promise.all(tables.map(async (t) => {
      const url = `${appUrl}/join/${shopId}?table=${t.tableNumber}`
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 })
      return { id: t.id, tableNumber: t.tableNumber, shopName: t.shop.name, url, dataUrl }
    }))

    return reply.send(result)
  })
}
