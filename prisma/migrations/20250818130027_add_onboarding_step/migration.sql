-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "plan_id" UUID,
    "employer_id" UUID,
    "userId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "gross_amount" INTEGER NOT NULL,
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transaction_id" TEXT,
    "fraud_status" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "public"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_plan_id_idx" ON "public"."payments"("plan_id");

-- CreateIndex
CREATE INDEX "payments_employer_id_idx" ON "public"."payments"("employer_id");

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
