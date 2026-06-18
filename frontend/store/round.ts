import { create } from 'zustand'

interface Round {
  id: string
  status: 'open' | 'locked' | 'settled' | 'cancelled'
  totalEven: number
  totalOdd: number
  result?: 'even' | 'odd' | null
  openedAt: string
  expiresAt?: string
}

interface Bet {
  id: string
  side: 'even' | 'odd'
  amountRequested: number
  amountAccepted: number
  payout?: number
  status: string
  createdAt: string
}

interface RoundState {
  round: Round | null
  myBets: Bet[]
  timeLeft: number
  setRound: (round: Round | null) => void
  setMyBets: (bets: Bet[]) => void
  addBet: (bet: Bet) => void
  updateOdds: (even: number, odd: number) => void
  setTimeLeft: (t: number) => void
}

export const useRoundStore = create<RoundState>((set) => ({
  round: null,
  myBets: [],
  timeLeft: 0,
  setRound: (round) => set({ round }),
  setMyBets: (myBets) => set({ myBets }),
  addBet: (bet) => set((s) => ({ myBets: [bet, ...s.myBets] })),
  updateOdds: (even, odd) =>
    set((s) => s.round ? { round: { ...s.round, totalEven: even, totalOdd: odd } } : {}),
  setTimeLeft: (timeLeft) => set({ timeLeft }),
}))
