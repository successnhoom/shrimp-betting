-- CreateTable (safe: skip if already exists)
CREATE TABLE IF NOT EXISTS "deposit_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "slip_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "telegram_msg_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "deposit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable (safe: skip if already exists)
CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex (safe)
CREATE INDEX IF NOT EXISTS "deposit_requests_user_id_idx" ON "deposit_requests"("user_id");

-- CreateIndex (safe)
CREATE INDEX IF NOT EXISTS "deposit_requests_status_idx" ON "deposit_requests"("status");

-- AddForeignKey (safe: skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deposit_requests_user_id_fkey'
  ) THEN
    ALTER TABLE "deposit_requests" ADD CONSTRAINT "deposit_requests_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
