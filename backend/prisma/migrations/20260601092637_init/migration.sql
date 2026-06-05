-- DropForeignKey
ALTER TABLE "bets" DROP CONSTRAINT "bets_round_id_fkey";

-- DropForeignKey
ALTER TABLE "bets" DROP CONSTRAINT "bets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "rounds" DROP CONSTRAINT "rounds_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "rounds" DROP CONSTRAINT "rounds_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "shop_staff" DROP CONSTRAINT "shop_staff_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "shop_staff" DROP CONSTRAINT "shop_staff_user_id_fkey";

-- DropForeignKey
ALTER TABLE "shops" DROP CONSTRAINT "shops_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "tables" DROP CONSTRAINT "tables_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_user_id_fkey";

-- AlterTable
ALTER TABLE "bets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "otp_codes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_intents" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "fulfilled_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rounds" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "opened_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "closed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "settled_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shops" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tables" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "phone" SET DATA TYPE TEXT,
ALTER COLUMN "display_name" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
