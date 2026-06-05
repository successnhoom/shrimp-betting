-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'staff', 'admin');
CREATE TYPE "RoundStatus" AS ENUM ('open', 'locked', 'settled', 'cancelled');
CREATE TYPE "BetSide" AS ENUM ('even', 'odd');
CREATE TYPE "BetStatus" AS ENUM ('pending', 'accepted', 'partial', 'refunded', 'won', 'lost');
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'withdraw', 'bet_lock', 'bet_refund', 'payout', 'shop_fee');

-- CreateTable: users
CREATE TABLE "users" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "phone"        VARCHAR(15) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "role"         "Role" NOT NULL DEFAULT 'customer',
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateTable: wallets
CREATE TABLE "wallets" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"       TEXT NOT NULL,
    "balance"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "locked_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateTable: shops
CREATE TABLE "shops" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name"        TEXT NOT NULL,
    "owner_id"    TEXT NOT NULL,
    "payout_rate" DECIMAL(4,2) NOT NULL DEFAULT 0.90,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable: shop_staff
CREATE TABLE "shop_staff" (
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "shop_staff_pkey" PRIMARY KEY ("shop_id","user_id")
);

-- CreateTable: tables
CREATE TABLE "tables" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shop_id"      TEXT NOT NULL,
    "table_number" INTEGER NOT NULL,
    "qr_code_url"  TEXT,
    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tables_shop_id_table_number_key" ON "tables"("shop_id","table_number");

-- CreateTable: rounds
CREATE TABLE "rounds" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shop_id"    TEXT NOT NULL,
    "staff_id"   TEXT NOT NULL,
    "status"     "RoundStatus" NOT NULL DEFAULT 'open',
    "total_even" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_odd"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "result"     "BetSide",
    "opened_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at"  TIMESTAMPTZ,
    "settled_at" TIMESTAMPTZ,
    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bets
CREATE TABLE "bets" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "round_id"         TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "side"             "BetSide" NOT NULL,
    "amount_requested" DECIMAL(12,2) NOT NULL,
    "amount_accepted"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payout"           DECIMAL(12,2),
    "status"           "BetStatus" NOT NULL DEFAULT 'pending',
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transactions
CREATE TABLE "transactions" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"    TEXT NOT NULL,
    "type"       "TransactionType" NOT NULL,
    "amount"     DECIMAL(12,2) NOT NULL,
    "ref_id"     TEXT,
    "note"       TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: otp_codes
CREATE TABLE "otp_codes" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "phone"      TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used"       BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes"("phone");

-- CreateTable: payment_intents
CREATE TABLE "payment_intents" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"          TEXT NOT NULL,
    "stripe_intent_id" TEXT NOT NULL,
    "amount"           DECIMAL(12,2) NOT NULL,
    "currency"         TEXT NOT NULL DEFAULT 'thb',
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at"     TIMESTAMPTZ,
    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_intents_stripe_intent_id_key" ON "payment_intents"("stripe_intent_id");

-- Foreign Keys
ALTER TABLE "wallets"         ADD CONSTRAINT "wallets_user_id_fkey"         FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "shops"           ADD CONSTRAINT "shops_owner_id_fkey"          FOREIGN KEY ("owner_id") REFERENCES "users"("id");
ALTER TABLE "shop_staff"      ADD CONSTRAINT "shop_staff_shop_id_fkey"      FOREIGN KEY ("shop_id")  REFERENCES "shops"("id");
ALTER TABLE "shop_staff"      ADD CONSTRAINT "shop_staff_user_id_fkey"      FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "tables"          ADD CONSTRAINT "tables_shop_id_fkey"          FOREIGN KEY ("shop_id")  REFERENCES "shops"("id");
ALTER TABLE "rounds"          ADD CONSTRAINT "rounds_shop_id_fkey"          FOREIGN KEY ("shop_id")  REFERENCES "shops"("id");
ALTER TABLE "rounds"          ADD CONSTRAINT "rounds_staff_id_fkey"         FOREIGN KEY ("staff_id") REFERENCES "users"("id");
ALTER TABLE "bets"            ADD CONSTRAINT "bets_round_id_fkey"           FOREIGN KEY ("round_id") REFERENCES "rounds"("id");
ALTER TABLE "bets"            ADD CONSTRAINT "bets_user_id_fkey"            FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "transactions"    ADD CONSTRAINT "transactions_user_id_fkey"    FOREIGN KEY ("user_id")  REFERENCES "users"("id");

-- Performance Indexes
CREATE INDEX "bets_round_id_idx"            ON "bets"("round_id");
CREATE INDEX "bets_user_id_idx"             ON "bets"("user_id");
CREATE INDEX "bets_status_idx"              ON "bets"("status");
CREATE INDEX "rounds_shop_id_status_idx"    ON "rounds"("shop_id", "status");
CREATE INDEX "rounds_settled_at_idx"        ON "rounds"("settled_at");
CREATE INDEX "transactions_user_id_idx"     ON "transactions"("user_id");
CREATE INDEX "transactions_type_idx"        ON "transactions"("type");
CREATE INDEX "transactions_created_at_idx"  ON "transactions"("created_at");
