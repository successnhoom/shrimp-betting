import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../lib/prisma'
import { TransactionType } from '@prisma/client'

export async function getWallet(userId: string) {
  return prisma.wallet.findUniqueOrThrow({ where: { userId } })
}

export async function lockFunds(
  userId: string,
  amount: Decimal | number,
  refId: string,
  tx: any = prisma
) {
  const amt = typeof amount === 'number' ? new Decimal(amount) : amount

  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } })
  if (new Decimal(wallet.balance).lt(amt)) {
    throw new Error('INSUFFICIENT_BALANCE')
  }

  await tx.wallet.update({
    where: { userId },
    data: {
      balance: { decrement: amt },
      lockedAmount: { increment: amt },
    },
  })

  await tx.transaction.create({
    data: {
      userId,
      type: TransactionType.bet_lock,
      amount: amt.negated(),
      refId,
    },
  })
}

export async function unlockAndRefund(
  userId: string,
  amount: Decimal | number,
  refId: string,
  tx: any = prisma
) {
  const amt = typeof amount === 'number' ? new Decimal(amount) : amount

  await tx.wallet.update({
    where: { userId },
    data: {
      balance: { increment: amt },
      lockedAmount: { decrement: amt },
    },
  })

  await tx.transaction.create({
    data: {
      userId,
      type: TransactionType.bet_refund,
      amount: amt,
      refId,
    },
  })
}

export async function settlePayout(
  userId: string,
  lockedAmount: Decimal | number,
  payoutAmount: Decimal | number,
  refId: string,
  tx: any = prisma
) {
  const locked = typeof lockedAmount === 'number' ? new Decimal(lockedAmount) : lockedAmount
  const payout = typeof payoutAmount === 'number' ? new Decimal(payoutAmount) : payoutAmount

  // Unlock the locked amount and add payout
  await tx.wallet.update({
    where: { userId },
    data: {
      lockedAmount: { decrement: locked },
      balance: { increment: payout },
    },
  })

  await tx.transaction.create({
    data: {
      userId,
      type: TransactionType.payout,
      amount: payout,
      refId,
    },
  })
}

export async function settleLoser(
  userId: string,
  lockedAmount: Decimal | number,
  refId: string,
  tx: any = prisma
) {
  const locked = typeof lockedAmount === 'number' ? new Decimal(lockedAmount) : lockedAmount

  // Just unlock (remove from locked), money is gone
  await tx.wallet.update({
    where: { userId },
    data: {
      lockedAmount: { decrement: locked },
    },
  })
}

export async function addDeposit(
  userId: string,
  amount: number,
  refId: string
) {
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    })
    await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.deposit,
        amount: new Decimal(amount),
        refId,
      },
    })
  })
}

export async function requestWithdraw(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } })
    if (new Decimal(wallet.balance).lt(amount)) {
      throw new Error('INSUFFICIENT_BALANCE')
    }
    await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    })
    const txRecord = await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.withdraw,
        amount: new Decimal(-amount),
        note: 'Withdrawal request',
      },
    })
    return txRecord
  })
}
