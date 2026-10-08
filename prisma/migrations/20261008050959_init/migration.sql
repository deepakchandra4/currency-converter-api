-- CreateTable
CREATE TABLE "conversion_history" (
    "id" SERIAL NOT NULL,
    "from_currency" VARCHAR(3) NOT NULL,
    "to_currency" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "exchange_rate" DECIMAL(18,6) NOT NULL,
    "converted_amount" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversion_history_created_at_idx" ON "conversion_history"("created_at");
