import { vi } from 'vitest'

// Mock Prisma globally
vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => fn(mockTx)),
    bet:          { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    round:        { findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    wallet:       { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    transaction:  { create: vi.fn() },
    user:         { findUnique: vi.fn() },
  },
}))

// Mock socket
vi.mock('../lib/socket', () => ({
  emitRoundOpened:  vi.fn(),
  emitOddsUpdate:   vi.fn(),
  emitRoundLocked:  vi.fn(),
  emitRoundSettled: vi.fn(),
  emitRoundStopped: vi.fn(),
}))

// Mock BullMQ jobs
vi.mock('../jobs/round.jobs', () => ({
  scheduleRoundLock:  vi.fn().mockResolvedValue(undefined),
  cancelScheduledLock:vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../jobs/notification.jobs', () => ({
  notifyWinner:  vi.fn().mockResolvedValue(undefined),
  notifyDeposit: vi.fn().mockResolvedValue(undefined),
}))

// Shared mock tx object
export const mockTx = {
  bet:        { update: vi.fn(), create: vi.fn() },
  round:      { update: vi.fn() },
  wallet:     { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  transaction:{ create: vi.fn() },
}
