/**
 * Shared TypeScript types — used by both backend and frontend
 * Backend: import from '../../shared/types'
 * Frontend: import from '@/shared/types' (add alias in tsconfig)
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type Role        = 'customer' | 'staff' | 'admin'
export type RoundStatus = 'open' | 'locked' | 'settled' | 'cancelled'
export type BetSide     = 'even' | 'odd'
export type BetStatus   = 'pending' | 'accepted' | 'partial' | 'refunded' | 'won' | 'lost'
export type TxType      = 'deposit' | 'withdraw' | 'bet_lock' | 'bet_refund' | 'payout' | 'shop_fee'

// ── User ─────────────────────────────────────────────────────────────────────

export interface UserPublic {
  id:          string
  phone:       string
  displayName: string
  role:        Role
}

export interface UserWithWallet extends UserPublic {
  wallet: { balance: number; lockedAmount: number } | null
}

// ── Shop ─────────────────────────────────────────────────────────────────────

export interface Shop {
  id:         string
  name:       string
  payoutRate: number
  isActive:   boolean
}

export interface ShopWithCounts extends Shop {
  owner:      { id: string; displayName: string; phone: string }
  tableCount: number
  roundCount: number
  staffCount: number
}

// ── Round ─────────────────────────────────────────────────────────────────────

export interface Round {
  id:         string
  shopId:     string
  status:     RoundStatus
  totalEven:  number
  totalOdd:   number
  result:     BetSide | null
  openedAt:   string
  closedAt:   string | null
  settledAt:  string | null
}

export interface RoundWithExpiry extends Round {
  expiresAt:  string
}

// ── Bet ──────────────────────────────────────────────────────────────────────

export interface Bet {
  id:              string
  roundId:         string
  side:            BetSide
  amountRequested: number
  amountAccepted:  number
  payout:          number | null
  status:          BetStatus
  createdAt:       string
}

export interface BetWithRound extends Bet {
  round: {
    id:       string
    result:   BetSide | null
    shopName: string
    openedAt: string
  }
}

// ── Transaction ───────────────────────────────────────────────────────────────

export interface Transaction {
  id:        string
  type:      TxType
  amount:    number
  refId:     string | null
  note:      string | null
  createdAt: string
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank:         number
  userId:       string
  displayName:  string
  totalPayout:  number
  totalWagered: number
  wonBets:      number
}

// ── Socket events ─────────────────────────────────────────────────────────────

export interface RoundOpenedEvent {
  roundId:   string
  shopId:    string
  expiresAt: string
}

export interface OddsUpdateEvent {
  roundId: string
  even:    number
  odd:     number
}

export interface RoundSettledEvent {
  roundId:  string
  result:   BetSide
  payouts:  { userId: string; amount: number }[]
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:       T[]
  total:      number
  page:       number
  totalPages: number
}

export interface ApiError {
  error:   string
  message?: string
  issues?: { path: string; message: string }[]
}

// ── Profile stats ─────────────────────────────────────────────────────────────

export interface ProfileStats {
  balance:       number
  lockedAmount:  number
  totalBets:     number
  wonBets:       number
  lostBets:      number
  winRate:       number
  totalWagered:  number
  totalPayout:   number
  netProfit:     number
  currentStreak: number
  streakType:    'win' | 'loss' | null
  favouriteSide: BetSide
}

// ── Revenue ───────────────────────────────────────────────────────────────────

export interface RevenueSummary {
  totalVolume: number
  shopFee:     number
  totalRounds: number
}

export interface RevenueDayEntry {
  date:    string
  volume:  number
  rounds:  number
  fee:     number
}
