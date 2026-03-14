-- Password reset flow: single-use token storage + auth audit events
ALTER TYPE "public"."AuthEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "public"."AuthEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_COMPLETED';

CREATE TABLE "public"."password_reset_tokens" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "requestedByIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "public"."password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_orgId_userId_idx" ON "public"."password_reset_tokens"("orgId", "userId");
CREATE INDEX "password_reset_tokens_orgId_expiresAt_idx" ON "public"."password_reset_tokens"("orgId", "expiresAt");

ALTER TABLE "public"."password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
