-- Store signature artifacts and contract documents in DO Spaces object storage metadata
ALTER TABLE "public"."signature_requests"
  ADD COLUMN IF NOT EXISTS "unsignedPdfObjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "unsignedPdfSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "unsignedPdfSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "signatureImageObjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureImageSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureImageSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "lucitoursSignatureObjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "lucitoursSignatureSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "lucitoursSignatureSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "signedPdfObjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "signedPdfSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "signedPdfSizeBytes" INTEGER;

ALTER TABLE "public"."signature_requests"
  DROP COLUMN IF EXISTS "unsignedPdfBase64",
  DROP COLUMN IF EXISTS "signatureImageBase64",
  DROP COLUMN IF EXISTS "lucitoursSignatureImageBase64",
  DROP COLUMN IF EXISTS "signedPdfBase64";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractDocumentType') THEN
    CREATE TYPE "public"."ContractDocumentType" AS ENUM (
      'CEDULA_FRONT',
      'CEDULA_BACK',
      'PASSPORT',
      'PAYMENT_PROOF',
      'PROFILE_PHOTO_1',
      'PROFILE_PHOTO_2'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."contract_documents" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "type" "public"."ContractDocumentType" NOT NULL,
  "objectKey" TEXT NOT NULL,
  "originalName" TEXT,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_documents_objectKey_key" ON "public"."contract_documents"("objectKey");
CREATE INDEX IF NOT EXISTS "contract_documents_orgId_contractId_idx" ON "public"."contract_documents"("orgId", "contractId");
CREATE INDEX IF NOT EXISTS "contract_documents_orgId_type_idx" ON "public"."contract_documents"("orgId", "type");
