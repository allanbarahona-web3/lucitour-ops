-- Auth foundation: users, role assignments, JWT session tracking, and auth events
CREATE TYPE "public"."AppRole" AS ENUM (
  'ADMIN',
  'AGENT',
  'SUPERVISOR',
  'ACCOUNTING',
  'CONTRACTS',
  'QUOTES',
  'BILLING',
  'PURCHASES',
  'VIEWER'
);

CREATE TYPE "public"."AuthEventType" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_LOCKED',
  'TOKEN_REFRESHED',
  'LOGOUT'
);

CREATE TABLE "public"."users" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."user_roles" (
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "public"."AppRole" NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "role")
);

CREATE TABLE "public"."auth_sessions" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedByJti" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."auth_events" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "eventType" "public"."AuthEventType" NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_orgId_email_key" ON "public"."users"("orgId", "email");
CREATE INDEX "users_orgId_isActive_idx" ON "public"."users"("orgId", "isActive");
CREATE INDEX "user_roles_orgId_role_idx" ON "public"."user_roles"("orgId", "role");
CREATE UNIQUE INDEX "auth_sessions_jti_key" ON "public"."auth_sessions"("jti");
CREATE INDEX "auth_sessions_orgId_userId_idx" ON "public"."auth_sessions"("orgId", "userId");
CREATE INDEX "auth_sessions_orgId_expiresAt_idx" ON "public"."auth_sessions"("orgId", "expiresAt");
CREATE INDEX "auth_events_orgId_eventType_createdAt_idx" ON "public"."auth_events"("orgId", "eventType", "createdAt");
CREATE INDEX "auth_events_orgId_email_createdAt_idx" ON "public"."auth_events"("orgId", "email", "createdAt");

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "user_roles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."auth_sessions"
  ADD CONSTRAINT "auth_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."auth_events"
  ADD CONSTRAINT "auth_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
