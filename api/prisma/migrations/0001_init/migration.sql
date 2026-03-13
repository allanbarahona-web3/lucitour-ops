-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."SignatureRequestStatus" AS ENUM ('PENDING_OTP', 'PENDING_SIGNATURE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SignatureEventType" AS ENUM ('REQUEST_CREATED', 'OTP_GENERATED', 'OTP_FAILED', 'SIGNATURE_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED');

-- CreateEnum
CREATE TYPE "public"."SignatureActorType" AS ENUM ('SYSTEM', 'CLIENT', 'CONTRACTOR', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."signature_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" "public"."SignatureRequestStatus" NOT NULL DEFAULT 'PENDING_OTP',
    "publicToken" TEXT NOT NULL,
    "contractFileName" TEXT,
    "unsignedPdfBase64" TEXT,
    "otpCodeHash" TEXT,
    "otpSentAt" TIMESTAMP(3),
    "otpValidatedAt" TIMESTAMP(3),
    "signatureImageBase64" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "lucitoursSignatureImageBase64" TEXT,
    "signedPdfBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signature_request_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "type" "public"."SignatureEventType" NOT NULL,
    "actorType" "public"."SignatureActorType" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signature_requests_publicToken_key" ON "public"."signature_requests"("publicToken");

-- CreateIndex
CREATE INDEX "signature_requests_orgId_status_idx" ON "public"."signature_requests"("orgId", "status");

-- CreateIndex
CREATE INDEX "signature_requests_orgId_contractId_idx" ON "public"."signature_requests"("orgId", "contractId");

-- CreateIndex
CREATE INDEX "signature_request_events_orgId_signatureRequestId_idx" ON "public"."signature_request_events"("orgId", "signatureRequestId");

-- AddForeignKey
ALTER TABLE "public"."signature_request_events" ADD CONSTRAINT "signature_request_events_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "public"."signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

