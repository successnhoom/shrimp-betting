import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      autoConnect: false,
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('token') : '' },
    })
  }
  return socket
}

export function connectSocket(shopId: string) {
  const s = getSocket()
  if (!s.connected) s.connect()
  s.emit('join:shop', shopId)
  return s
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
