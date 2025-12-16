-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'executed', 'failed');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('whitelist', 'blacklist');

-- CreateTable
CREATE TABLE "passkeys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip20_contracts" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tip20_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_transactions" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "token_symbol" TEXT NOT NULL,
    "token_decimals" INTEGER NOT NULL,
    "fee_token" TEXT NOT NULL,
    "memo" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "scheduled_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "admin" TEXT NOT NULL,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_key_key" ON "passkeys"("key");

-- CreateIndex
CREATE INDEX "tip20_contracts_owner_idx" ON "tip20_contracts"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "tip20_contracts_owner_address_key" ON "tip20_contracts"("owner", "address");

-- CreateIndex
CREATE INDEX "contacts_owner_idx" ON "contacts"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_owner_address_key" ON "contacts"("owner", "address");

-- CreateIndex
CREATE INDEX "scheduled_transactions_owner_idx" ON "scheduled_transactions"("owner");

-- CreateIndex
CREATE INDEX "scheduled_transactions_owner_status_idx" ON "scheduled_transactions"("owner", "status");

-- CreateIndex
CREATE INDEX "policies_owner_idx" ON "policies"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "policies_owner_policy_id_key" ON "policies"("owner", "policy_id");

