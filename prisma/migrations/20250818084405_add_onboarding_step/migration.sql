-- CreateEnum
CREATE TYPE "public"."onboarding_step" AS ENUM ('PACKAGE', 'JOB', 'VERIFY', 'DONE');

-- AlterTable
ALTER TABLE "public"."employers" ADD COLUMN     "onboarding_step" "public"."onboarding_step" NOT NULL DEFAULT 'PACKAGE';
