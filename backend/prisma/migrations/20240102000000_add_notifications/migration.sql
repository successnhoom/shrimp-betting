-- CreateTable: notifications (in-app notification log)
CREATE TABLE "notifications" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"    TEXT NOT NULL,
    "type"       TEXT NOT NULL,          -- 'round_opened' | 'win' | 'deposit' | 'withdraw' | 'system'
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "data"       JSONB,                  -- extra payload (roundId, amount, etc.)
    "is_read"    BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_idx"    ON "notifications"("user_id");
CREATE INDEX "notifications_is_read_idx"    ON "notifications"("is_read");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
