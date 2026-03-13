-- Add brute-force protection fields for OTP verification
ALTER TABLE "public"."signature_requests"
  ADD COLUMN "otpAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "otpLockedUntil" TIMESTAMP(3);
