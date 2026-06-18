import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: '0800000000' },
    update: {},
    create: {
      phone: '0800000000',
      displayName: 'Admin',
      role: Role.admin,
      wallet: { create: { balance: 0 } },
    },
  })

  // Create shop
  const shop = await prisma.shop.upsert({
    where: { id: 'shop-demo-001' },
    update: {},
    create: {
      id: 'shop-demo-001',
      name: 'บ่อตกกุ้ง Demo',
      ownerId: admin.id,
      payoutRate: 0.90,
    },
  })

  // Create tables with QR codes
  for (let i = 1; i <= 5; i++) {
    await prisma.table.upsert({
      where: { shopId_tableNumber: { shopId: shop.id, tableNumber: i } },
      update: {},
      create: {
        shopId: shop.id,
        tableNumber: i,
        qrCodeUrl: `${process.env.APP_URL || 'http://localhost:3000'}/join/${shop.id}?table=${i}`,
      },
    })
  }

  // Create staff user
  const staff = await prisma.user.upsert({
    where: { phone: '0811111111' },
    update: {},
    create: {
      phone: '0811111111',
      displayName: 'พนักงาน 1',
      role: Role.staff,
      wallet: { create: { balance: 0 } },
    },
  })

  await prisma.shopStaff.upsert({
    where: { shopId_userId: { shopId: shop.id, userId: staff.id } },
    update: {},
    create: { shopId: shop.id, userId: staff.id },
  })

  console.log('✅ Seed complete')
  console.log(`   Admin phone: 0800000000`)
  console.log(`   Staff phone: 0811111111`)
  console.log(`   Shop ID: ${shop.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
