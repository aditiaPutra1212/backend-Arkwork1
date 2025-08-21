-- CreateEnum
CREATE TYPE "public"."employer_status" AS ENUM ('draft', 'active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "public"."company_size" AS ENUM ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+');

-- CreateEnum
CREATE TYPE "public"."verification_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "public"."employers" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "website" TEXT,
    "status" "public"."employer_status" NOT NULL DEFAULT 'draft',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employer_profiles" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "industry" TEXT,
    "size" "public"."company_size",
    "founded_year" INTEGER,
    "about" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "hq_city" TEXT,
    "hq_country" TEXT,
    "linkedin" TEXT,
    "twitter" TEXT,
    "instagram" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employer_admin_users" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "is_owner" BOOLEAN NOT NULL DEFAULT true,
    "agreed_tos_at" TIMESTAMP(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employer_offices" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "label" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is_remote_hub" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employer_contacts" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employer_meta" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "employer_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "amount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "provider_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription_items" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."jobs" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "employment" TEXT,
    "is_draft" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_requests" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "status" "public"."verification_status" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_files" (
    "id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verify_tokens" (
    "id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "verify_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employers_slug_key" ON "public"."employers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "employer_profiles_employer_id_key" ON "public"."employer_profiles"("employer_id");

-- CreateIndex
CREATE UNIQUE INDEX "employer_admin_users_email_key" ON "public"."employer_admin_users"("email");

-- CreateIndex
CREATE INDEX "employer_admin_users_employer_id_idx" ON "public"."employer_admin_users"("employer_id");

-- CreateIndex
CREATE INDEX "employer_offices_employer_id_idx" ON "public"."employer_offices"("employer_id");

-- CreateIndex
CREATE INDEX "employer_contacts_employer_id_idx" ON "public"."employer_contacts"("employer_id");

-- CreateIndex
CREATE UNIQUE INDEX "employer_meta_employer_id_key_key" ON "public"."employer_meta"("employer_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "public"."plans"("slug");

-- CreateIndex
CREATE INDEX "subscriptions_employer_id_idx" ON "public"."subscriptions"("employer_id");

-- CreateIndex
CREATE INDEX "subscription_items_subscription_id_idx" ON "public"."subscription_items"("subscription_id");

-- CreateIndex
CREATE INDEX "jobs_employer_id_is_active_idx" ON "public"."jobs"("employer_id", "is_active");

-- CreateIndex
CREATE INDEX "verification_requests_employer_id_status_idx" ON "public"."verification_requests"("employer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "verify_tokens_token_key" ON "public"."verify_tokens"("token");

-- AddForeignKey
ALTER TABLE "public"."employer_profiles" ADD CONSTRAINT "employer_profiles_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employer_admin_users" ADD CONSTRAINT "employer_admin_users_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employer_offices" ADD CONSTRAINT "employer_offices_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employer_contacts" ADD CONSTRAINT "employer_contacts_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employer_meta" ADD CONSTRAINT "employer_meta_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."verification_requests" ADD CONSTRAINT "verification_requests_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."verification_files" ADD CONSTRAINT "verification_files_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "public"."verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."verify_tokens" ADD CONSTRAINT "verify_tokens_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "public"."verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
