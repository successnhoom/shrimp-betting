# 🦐 ระบบเดิมพันตกกุ้ง (Shrimp Betting Platform)

**Production-ready Web Application** สำหรับร้านตกกุ้ง รองรับ Mobile + Desktop

---

## 📁 โครงสร้างโปรเจค

```
.
├── backend/                  # Fastify API Server
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema (8 tables)
│   │   ├── seed.ts           # Initial data
│   │   └── migrations/       # SQL migrations
│   └── src/
│       ├── index.ts          # Entry point
│       ├── routes/           # API endpoints
│       │   ├── auth.ts       # OTP login/register
│       │   ├── wallet.ts     # เติม/ถอน/Stripe/PromptPay
│       │   ├── rounds.ts     # ดูรอบ + วางเดิมพัน
│       │   ├── staff.ts      # ควบคุมรอบ + live monitor
│       │   ├── admin.ts      # จัดการร้าน/ผู้ใช้/รายรับ/CSV
│       │   ├── profile.ts    # สถิติส่วนตัว + bet history
│       │   ├── leaderboard.ts# อันดับผู้ชนะ
│       │   ├── shops.ts      # ข้อมูลร้าน (public)
│       │   └── qr.ts         # สร้าง QR Code
│       ├── services/
│       │   ├── round.service.ts   # business logic รอบ
│       │   ├── wallet.service.ts  # lock/unlock/payout
│       │   ├── otp.service.ts     # SMS OTP
│       │   └── promptpay.service.ts # PromptPay QR EMV
│       ├── middleware/
│       │   ├── auth.ts        # JWT verify
│       │   ├── rateLimiter.ts # per-user rate limit
│       │   └── audit.ts       # admin action log
│       ├── jobs/
│       │   ├── round.jobs.ts        # BullMQ auto-lock
│       │   └── notification.jobs.ts # SMS async queue
│       └── lib/
│           ├── prisma.ts  ├── redis.ts  ├── socket.ts
│           ├── health.ts  ├── errors.ts ├── helmet.ts
│           └── sentry.ts
├── frontend/                 # Next.js 14 App
│   ├── app/
│   │   ├── auth/             # Login / Register (OTP)
│   │   ├── bet/              # หน้าแทงพนัน Real-time
│   │   ├── wallet/           # กระเป๋าเงิน + PromptPay
│   │   ├── profile/          # โปรไฟล์ + สถิติ + bet history
│   │   ├── leaderboard/      # อันดับ
│   │   ├── join/[shopId]/    # QR scan landing
│   │   ├── staff/            # Staff panel (control+live+deposits)
│   │   └── admin/            # Admin dashboard (7 หน้า)
│   ├── components/
│   │   ├── BetPanel.tsx      # วางเดิมพัน UI
│   │   ├── OddsBoard.tsx     # live odds + timer
│   │   ├── AdminNav.tsx      # sidebar + bottom nav
│   │   ├── PushButton.tsx    # Web Push opt-in
│   │   ├── ErrorBoundary.tsx
│   │   └── ui/               # Modal, Skeleton, StatCard
│   ├── lib/
│   │   ├── api.ts    # Axios + all API calls
│   │   ├── socket.ts # Socket.io client
│   │   └── push.ts   # Web Push
│   ├── store/
│   │   ├── auth.ts   # Zustand auth state
│   │   └── round.ts  # Zustand round/bet state
│   └── public/sw.js  # Service Worker (PWA + Push)
├── docker-compose.yml        # Local dev (postgres + redis)
└── README.md
```

---

## ✅ Features ครบที่สร้างแล้ว

### ลูกค้า
- สแกน QR Code โต๊ะ → เข้าระบบอัตโนมัติ
- Login / Register ด้วยเบอร์โทร + OTP
- เติมเงินผ่าน Stripe (Credit Card) หรือ PromptPay QR
- ถอนเงิน (พนักงาน/admin อนุมัติ)
- วางเดิมพัน คู่/คี่ แบบ real-time
- เห็น live odds อัพเดตทันที
- รับเงินรางวัล 90% อัตโนมัติ
- โปรไฟล์: สถิติ win rate, streak, กำไร/ขาดทุน
- ประวัติการแทงทั้งหมด (filter ได้)
- ตารางอันดับ (วันนี้/สัปดาห์/เดือน)
- Web Push notification (รอบเปิด + ชนะ)
- PWA — ติดตั้งบนมือถือได้

### พนักงาน
- เปิด/ปิดรอบ จากมือถือ
- ดู live bets ระหว่างรอบ (real-time)
- เห็นยอดคู่/คี่ + แถบ balance
- แจ้งเตือนยอดไม่เท่า (auto-balance)
- กด คู่/คี่ ออกผล → ระบบจ่ายเงินอัตโนมัติ
- ยืนยัน PromptPay deposit ของลูกค้า
- ดูประวัติรอบวันนี้

### Admin
- Dashboard: รายรับ/รอบ/ยอด real-time
- จัดการร้าน (สร้าง/แก้ไข/เปิด-ปิด)
- สร้างโต๊ะ + generate QR Code
- จัดการพนักงาน (เพิ่ม/ลบ)
- จัดการผู้ใช้ (ค้นหา/ปิดบัญชี/ปรับเครดิต)
- รายงานรายรับรายวัน (filter ตามร้าน/ช่วงเวลา)
- Export CSV (เปิด Excel ได้ภาษาไทย)
- อนุมัติคำขอถอนเงิน
- Void round (ยกเลิกรอบหลัง settle ภายใน 5 นาที)

---

## 🚀 เริ่มใช้งาน

### ขั้นที่ 1 — ติดตั้ง

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### ขั้นที่ 2 — ตั้งค่า environment

```bash
cd backend && cp .env.example .env   # แก้ค่าให้ครบ
cd frontend && cp .env.example .env.local
```

### ขั้นที่ 3 — รัน Database

```bash
# ต้องมี Docker
docker-compose up postgres redis -d
```

### ขั้นที่ 4 — Migrate + Seed

```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

### ขั้นที่ 5 — รัน

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

เปิด http://localhost:3000

---

## ☁️ Deploy Production

### Backend → Railway
1. New Project → Deploy from GitHub (folder: `backend`)
2. Add **PostgreSQL** plugin + **Redis** plugin
3. ตั้งค่า Environment Variables ตาม `.env.example`
4. Railway auto-detect Dockerfile → deploy

### Frontend → Vercel
1. Import repo → Root Directory: `frontend`
2. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://your-api.railway.app`
   - `NEXT_PUBLIC_SOCKET_URL` = `https://your-api.railway.app`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Stripe Webhook
```
URL: https://your-api.railway.app/api/wallet/webhook/stripe
Events: payment_intent.succeeded
```

---

## 👥 บัญชีทดสอบ

| Role  | เบอร์       | หมายเหตุ         |
|-------|-------------|-----------------|
| Admin | 0800000000  | เจ้าของระบบ      |
| Staff | 0811111111  | พนักงาน         |

> **Dev Mode:** OTP แสดงในหน้าเว็บ ไม่ส่ง SMS จริง

---

## 🔧 Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Backend     | Fastify, TypeScript, Prisma, PostgreSQL         |
| Real-time   | Socket.io, BullMQ, Redis                        |
| Payment     | Stripe, PromptPay (EMV QR)                      |
| SMS         | Twilio                                          |
| Frontend    | Next.js 14, Tailwind CSS, Zustand, React Query  |
| Push        | Web Push API + Service Worker                   |
| Monitoring  | Sentry, Pino logger, /health endpoint           |
| Deploy      | Railway (backend), Vercel (frontend)            |

---

## 📡 API Summary

| Method | Path                              | คำอธิบาย              |
|--------|-----------------------------------|-----------------------|
| POST   | /api/auth/send-otp                | ส่ง OTP               |
| POST   | /api/auth/login                   | Login                 |
| POST   | /api/auth/register                | สมัครสมาชิก           |
| GET    | /api/wallet                       | ดู wallet + ประวัติ   |
| POST   | /api/wallet/deposit               | เติมเงิน Stripe        |
| POST   | /api/wallet/deposit/promptpay     | สร้าง PromptPay QR    |
| POST   | /api/wallet/withdraw              | ขอถอนเงิน             |
| GET    | /api/shops/:id/round/current      | รอบปัจจุบัน           |
| POST   | /api/rounds/:id/bets              | วางเดิมพัน            |
| GET    | /api/profile/stats                | สถิติส่วนตัว          |
| GET    | /api/profile/bets                 | ประวัติการแทง         |
| GET    | /api/leaderboard                  | ตารางอันดับ           |
| POST   | /api/staff/rounds/open            | เปิดรอบ               |
| GET    | /api/staff/rounds/:id/bets        | live bets monitor     |
| POST   | /api/staff/rounds/:id/settle      | ออกผล                 |
| POST   | /api/staff/rounds/:id/stop        | ยกเลิกรอบ             |
| POST   | /api/staff/rounds/:id/void        | void หลัง settle      |
| GET    | /api/admin/revenue                | รายรับ                |
| GET    | /api/admin/revenue/export         | Export CSV            |
| GET    | /api/qr/shop/:id/all              | QR ทุกโต๊ะ            |
| GET    | /health                           | health check          |
