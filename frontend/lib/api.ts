import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  sendOtp:  (phone: string) => api.post('/auth/send-otp', { phone }),
  login:    (phone: string, code: string) => api.post('/auth/login', { phone, code }),
  register: (phone: string, displayName: string, code: string) =>
    api.post('/auth/register', { phone, displayName, code }),
  me: () => api.get('/auth/me'),
}

// Wallet
export const walletApi = {
  get:             () => api.get('/wallet'),
  deposit:         (amount: number) => api.post('/wallet/deposit', { amount }),
  depositPromptPay:(amount: number) => api.post('/wallet/deposit/promptpay', { amount }),
  confirmPromptPay:(userId: string, amount: number) =>
    api.post('/wallet/deposit/promptpay/confirm', { userId, amount }),
  withdraw:        (amount: number) => api.post('/wallet/withdraw', { amount }),
  transactions:    (page = 1) => api.get(`/wallet/transactions?page=${page}`),
}

// Rounds / Betting
export const betApi = {
  getCurrentRound: (shopId: string) => api.get(`/shops/${shopId}/round/current`),
  placeBet: (roundId: string, side: 'even' | 'odd', amount: number) =>
    api.post(`/rounds/${roundId}/bets`, { side, amount }),
  myBets:   (roundId: string) => api.get(`/rounds/${roundId}/bets/my`),
  getRound: (roundId: string) => api.get(`/rounds/${roundId}`),
}

// Staff
export const staffApi = {
  openRound:   (shopId: string) => api.post('/staff/rounds/open', { shopId }),
  settleRound: (roundId: string, result: 'even' | 'odd') =>
    api.post(`/staff/rounds/${roundId}/settle`, { result }),
  nextRound:   (roundId: string) => api.post(`/staff/rounds/${roundId}/next`),
  stopRound:   (roundId: string) => api.post(`/staff/rounds/${roundId}/stop`),
  summary:     (shopId: string) => api.get(`/staff/shops/${shopId}/summary`),
  rounds:      (shopId: string) => api.get(`/staff/shops/${shopId}/rounds`),
  getRoundBets:(roundId: string) => api.get(`/staff/rounds/${roundId}/bets`),
  voidRound:   (roundId: string) => api.post(`/staff/rounds/${roundId}/void`),
  pendingDeposits: (shopId: string) => api.get(`/staff/shops/${shopId}/pending-deposits`),
  confirmDeposit:  (userId: string, amount: number) =>
    api.post('/wallet/deposit/promptpay/confirm', { userId, amount }),
}

// Shops (public)
export const shopApi = {
  get:    (shopId: string) => api.get(`/shops/${shopId}`),
  tables: (shopId: string) => api.get(`/shops/${shopId}/tables`),
}

// QR
export const qrApi = {
  tableDataUrl: (tableId: string) =>
    api.get(`/qr/table/${tableId}?format=dataurl`).then(r => r.data),
  allTables: (shopId: string) =>
    api.get(`/qr/shop/${shopId}/all`).then(r => r.data),
}

// Profile
export const profileApi = {
  stats:       () => api.get('/profile/stats'),
  bets:        (page = 1, status?: string, side?: string) =>
    api.get(`/profile/bets?page=${page}${status ? `&status=${status}` : ''}${side ? `&side=${side}` : ''}`),
  updateName:  (displayName: string) => api.patch('/profile/me', { displayName }),
}

// Leaderboard
export const leaderboardApi = {
  get: (shopId?: string, period = 'today') =>
    api.get(`/leaderboard?period=${period}${shopId ? `&shopId=${shopId}` : ''}`),
}

// Admin
export const adminApi = {
  getShops:     () => api.get('/admin/shops'),
  createShop:   (data: { name: string; payoutRate?: number; ownerPhone?: string }) =>
    api.post('/admin/shops', data),
  updateShop:   (id: string, data: object) => api.patch(`/admin/shops/${id}`, data),
  createTables: (shopId: string, count: number) =>
    api.post(`/admin/shops/${shopId}/tables`, { count }),
  getStaff:     (shopId: string) => api.get(`/admin/shops/${shopId}/staff`),
  addStaff:     (shopId: string, phone: string) =>
    api.post(`/admin/shops/${shopId}/staff`, { phone }),
  removeStaff:  (shopId: string, userId: string) =>
    api.delete(`/admin/shops/${shopId}/staff/${userId}`),
  getUsers:     (q?: string, page = 1) =>
    api.get(`/admin/users?q=${q || ''}&page=${page}`),
  updateUser:   (id: string, data: object) => api.patch(`/admin/users/${id}`, data),
  adjustBalance:(id: string, amount: number, note: string) =>
    api.post(`/admin/users/${id}/adjust-balance`, { amount, note }),
  getRevenue:   (from?: string, to?: string, shopId?: string) =>
    api.get(`/admin/revenue?from=${from || ''}&to=${to || ''}&shopId=${shopId || ''}`),
  getRevenueByShop: () => api.get('/admin/revenue/shops'),
  exportCsv:    (from: string, to: string) =>
    api.get(`/admin/revenue/export?from=${from}&to=${to}`, { responseType: 'blob' }),
  getWithdrawals:    () => api.get('/admin/withdrawals'),
  approveWithdrawal: (txId: string) => api.post(`/admin/withdrawals/${txId}/approve`),
  confirmDeposit:    (userId: string, amount: number) =>
    walletApi.confirmPromptPay(userId, amount),
}

// Notifications
export const notifApi = {
  list:      (page = 1, unreadOnly = false) =>
    api.get(`/notifications?page=${page}&unreadOnly=${unreadOnly}`),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead:  (id: string) => api.patch(`/notifications/${id}/read`),
  markAll:   () => api.patch('/notifications/read-all'),
  delete:    (id: string) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete('/notifications'),
}
