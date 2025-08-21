/*
  Warnings:

  - You are about to drop the column `price_id` on the `plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."plans" DROP COLUMN "price_id",
ADD COLUMN     "priceId" TEXT;
