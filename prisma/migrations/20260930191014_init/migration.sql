-- CreateEnum
CREATE TYPE "CustomerPlan" AS ENUM ('free', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('billing', 'bug', 'account_access', 'feature_request', 'other');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "TriageDecision" AS ENUM ('auto_accept', 'manual_review');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_plan" "CustomerPlan" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "category" "TicketCategory",
    "priority" "TicketPriority",
    "summary" TEXT,
    "triageDecision" "TriageDecision",
    "reviewReason" TEXT,
    "claimed_by" TEXT,
    "claimed_at" TIMESTAMP(3),
    "parent_ticket_id" TEXT,
    "sla_deadline" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_classifications" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "category" "TicketCategory",
    "priority" "TicketPriority",
    "summary" TEXT,
    "token_usage" INTEGER,
    "model" TEXT,
    "duration_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_external_id_key" ON "tickets"("external_id");

-- CreateIndex
CREATE INDEX "tickets_status_id_idx" ON "tickets"("status", "id");

-- CreateIndex
CREATE INDEX "tickets_priority_id_idx" ON "tickets"("priority", "id");

-- CreateIndex
CREATE INDEX "tickets_category_id_idx" ON "tickets"("category", "id");

-- CreateIndex
CREATE INDEX "tickets_triageDecision_id_idx" ON "tickets"("triageDecision", "id");

-- CreateIndex
CREATE INDEX "tickets_parent_ticket_id_idx" ON "tickets"("parent_ticket_id");

-- CreateIndex
CREATE INDEX "ai_classifications_ticket_id_idx" ON "ai_classifications"("ticket_id");

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
