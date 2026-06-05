import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'

let io: SocketServer

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    // Join shop room
    socket.on('join:shop', (shopId: string) => {
      socket.join(`shop:${shopId}`)
      console.log(`Socket ${socket.id} joined shop:${shopId}`)
    })

    // Join as staff
    socket.on('join:staff', (shopId: string) => {
      socket.join(`staff:${shopId}`)
    })

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
