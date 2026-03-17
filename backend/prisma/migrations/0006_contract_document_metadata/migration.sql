ALTER TYPE "public"."ContractDocumentType" ADD VALUE IF NOT EXISTS 'MINOR_PERMIT';
ALTER TYPE "public"."ContractDocumentType" ADD VALUE IF NOT EXISTS 'INSURANCE';

ALTER TABLE "public"."contract_documents"
  ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
  ADD COLUMN IF NOT EXISTS "concept" TEXT,
  ADD COLUMN IF NOT EXISTS "conceptOther" TEXT;
