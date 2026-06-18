import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import jwt from 'jsonwebtoken'

let io: SocketServer

export function initSocket(httpServer: HttpServer) {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean)

  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
        callback(new Error('Not allowed by CORS'), false)
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  })

  // SEC-10 fix: verify JWT before accepting any socket connection
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '')

    if (!token) return next(new Error('Authentication required'))

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || '') as any
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as { userId: string; role: string }
    console.log(`Socket connected: ${socket.id} (user: ${user.userId})`)

    // Join shop room — any authenticated user can join to receive live round events
    socket.on('join:shop', (shopId: string) => {
      socket.join(`shop:${shopId}`)
      console.log(`Socket ${socket.id} joined shop:${shopId}`)
    })

    // Join staff room — restricted to staff/admin roles
    socket.on('join:staff', (shopId: string) => {
      if (!['staff', 'admin'].includes(user.role)) return
      socket.join(`staff:${shopId}`)
    })

    // Join personal room for bet notifications
    socket.join(`user:${user.userId}`)

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

// Emit helpers
export function emitRoundOpened(shopId: string, payload: object) {
  getIO().to(`shop:${shopId}`).emit('round:opened', payload)
}

export function emitOddsUpdate(shopId: string, payload: object) {
  getIO().to(`shop:${shopId}`).emit('odds:update', payload)
}

export function emitRoundLocked(shopId: string, roundId: string) {
  getIO().to(`shop:${shopId}`).emit('round:locked', { roundId })
}

export function emitRoundSettled(shopId: string, payload: object) {
  getIO().to(`shop:${shopId}`).emit('round:settled', payload)
}

export function emitRoundStopped(shopId: string, roundId: string) {
  getIO().to(`shop:${shopId}`).emit('round:stopped', { roundId })
}

export function emitBetAccepted(userId: string, payload: object) {
  getIO().to(`user:${userId}`).emit('bet:accepted', payload)
}
