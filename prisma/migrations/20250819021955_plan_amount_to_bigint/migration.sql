-- DropIndex
DROP INDEX "public"."payments_status_idx";

-- AlterTable
ALTER TABLE "public"."payments" ALTER COLUMN "gross_amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "public"."plans" ALTER COLUMN "amount" SET DATA TYPE BIGINT;
