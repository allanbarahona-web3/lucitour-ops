import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppRole, AuthEventType, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { JwtPayload } from './types/jwt-payload.type';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MINUTES = 15;
const RESET_TOKEN_BYTES = 32;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    const seedPassword = process.env.SEED_MASTER_PASSWORD?.trim();
    if (!seedPassword) {
      return;
    }

    const seedOrgId = process.env.SEED_MASTER_ORG_ID?.trim() || 'lucitour';
    const seedEmail = process.env.SEED_MASTER_EMAIL?.trim() || 'admin@lucitour.com';
    const seedName = process.env.SEED_MASTER_NAME?.trim() || 'Master Admin';

    await this.prisma.withOrg(seedOrgId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          orgId: seedOrgId,
          email: seedEmail.toLowerCase(),
        },
      });

      if (existing) {
        return;
      }

      const passwordHash = await argon2.hash(seedPassword);
      const user = await tx.user.create({
        data: {
          orgId: seedOrgId,
          email: seedEmail.toLowerCase(),
          fullName: seedName,
          passwordHash,
          isActive: true,
        },
      });

      await tx.userRole.createMany({
        data: Object.values(AppRole).map((role) => ({
          userId: user.id,
          orgId: seedOrgId,
          role,
        })),
      });
    });
  }

  async login(
    orgId: string,
    input: LoginDto,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; fullName: string; roles: AppRole[] };
  }> {
    const identifier = input.identifier.trim().toLowerCase();
    const isEmailLogin = identifier.includes('@');
    const usernamePrefix = isEmailLogin ? null : identifier;

    return this.prisma.withOrg(orgId, async (tx) => {
      const windowStart = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
      const failedCount = await tx.authEvent.count({
        where: {
          orgId,
          email: identifier,
          eventType: AuthEventType.LOGIN_FAILED,
          createdAt: {
            gte: windowStart,
          },
          ipAddress: requestMeta.ipAddress ?? undefined,
        },
      });

      if (failedCount >= LOGIN_MAX_ATTEMPTS) {
        await this.createAuthEvent(tx, {
          orgId,
          email: identifier,
          eventType: AuthEventType.LOGIN_LOCKED,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        });
        throw new UnauthorizedException('Too many failed login attempts. Try again later.');
      }

      const matchingUsers = await tx.user.findMany({
        where: {
          orgId,
          email: isEmailLogin ? identifier : { startsWith: `${usernamePrefix}@` },
        },
        include: {
          roles: true,
        },
        take: isEmailLogin ? 1 : 2,
      });

      if (!isEmailLogin && matchingUsers.length > 1) {
        throw new UnauthorizedException('Usuario ambiguo. Inicia sesion con correo completo.');
      }

      const user = matchingUsers[0];

      const passwordOk = user
        ? await argon2.verify(user.passwordHash, input.password).catch(() => false)
        : false;

      if (!user || !passwordOk || !user.isActive) {
        await this.createAuthEvent(tx, {
          orgId,
          userId: user?.id,
          email: identifier,
          eventType: AuthEventType.LOGIN_FAILED,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      const roles = user.roles.map((role) => role.role);
      const sessionJti = randomUUID();
      const accessToken = this.signAccessToken({
        sub: user.id,
        orgId,
        email: user.email,
        roles,
        sid: sessionJti,
        type: 'access',
      });
      const refreshToken = this.signRefreshToken({
        sub: user.id,
        orgId,
        email: user.email,
        roles,
        sid: sessionJti,
        type: 'refresh',
      });

      const refreshTokenHash = await argon2.hash(refreshToken);
      const refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '14');
      const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

      await tx.authSession.create({
        data: {
          orgId,
          userId: user.id,
          jti: sessionJti,
          refreshTokenHash,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      await this.createAuthEvent(tx, {
        orgId,
        userId: user.id,
        email: user.email,
        eventType: AuthEventType.LOGIN_SUCCESS,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles,
        },
      };
    });
  }

  async refresh(
    orgId: string,
    refreshToken: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(refreshToken);
    if (payload.orgId !== orgId) {
      throw new UnauthorizedException('Token organization mismatch');
    }

    return this.prisma.withOrg(orgId, async (tx) => {
      const session = await tx.authSession.findFirst({
        where: {
          orgId,
          jti: payload.sid,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            include: {
              roles: true,
            },
          },
        },
      });

      if (!session || !session.user.isActive) {
        throw new UnauthorizedException('Session not active');
      }

      const tokenMatches = await argon2
        .verify(session.refreshTokenHash, refreshToken)
        .catch(() => false);
      if (!tokenMatches) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const roles = session.user.roles.map((role) => role.role);
      const nextJti = randomUUID();
      const nextAccessToken = this.signAccessToken({
        sub: session.user.id,
        orgId,
        email: session.user.email,
        roles,
        sid: nextJti,
        type: 'access',
      });
      const nextRefreshToken = this.signRefreshToken({
        sub: session.user.id,
        orgId,
        email: session.user.email,
        roles,
        sid: nextJti,
        type: 'refresh',
      });

      const refreshTokenHash = await argon2.hash(nextRefreshToken);
      const refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '14');
      const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

      await tx.authSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          replacedByJti: nextJti,
        },
      });

      await tx.authSession.create({
        data: {
          orgId,
          userId: session.user.id,
          jti: nextJti,
          refreshTokenHash,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          expiresAt,
        },
      });

      await this.createAuthEvent(tx, {
        orgId,
        userId: session.user.id,
        email: session.user.email,
        eventType: AuthEventType.TOKEN_REFRESHED,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });

      return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      };
    });
  }

  async requestPasswordReset(
    orgId: string,
    emailInput: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const email = emailInput.trim().toLowerCase();

    await this.prisma.withOrg(orgId, async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          orgId,
          email,
          isActive: true,
        },
      });

      // Always return success semantics to avoid email enumeration.
      if (!user) {
        return;
      }

      const ttlMinutes = Number(process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES ?? '30');
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
      const tokenHash = this.hashResetToken(rawToken);

      await tx.passwordResetToken.updateMany({
        where: {
          orgId,
          userId: user.id,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          orgId,
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedByIp: requestMeta.ipAddress,
        },
      });

      await this.createAuthEvent(tx, {
        orgId,
        userId: user.id,
        email: user.email,
        eventType: AuthEventType.PASSWORD_RESET_REQUESTED,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });

      await this.sendPasswordResetEmail(user.email, rawToken);
    });
  }

  async resetPassword(
    orgId: string,
    token: string,
    newPassword: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new BadRequestException('Invalid reset token');
    }

    await this.prisma.withOrg(orgId, async (tx) => {
      const resetRecord = await tx.passwordResetToken.findFirst({
        where: {
          orgId,
          tokenHash: this.hashResetToken(normalizedToken),
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

      if (!resetRecord || !resetRecord.user.isActive) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const nextPasswordHash = await argon2.hash(newPassword);
      await tx.user.update({
        where: {
          id: resetRecord.userId,
        },
        data: {
          passwordHash: nextPasswordHash,
        },
      });

      await tx.passwordResetToken.update({
        where: {
          id: resetRecord.id,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.authSession.updateMany({
        where: {
          orgId,
          userId: resetRecord.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.createAuthEvent(tx, {
        orgId,
        userId: resetRecord.userId,
        email: resetRecord.user.email,
        eventType: AuthEventType.PASSWORD_RESET_COMPLETED,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
    });
  }

  async logout(orgId: string, userId: string): Promise<void> {
    await this.prisma.withOrg(orgId, async (tx) => {
      await tx.authSession.updateMany({
        where: {
          orgId,
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.createAuthEvent(tx, {
        orgId,
        userId,
        eventType: AuthEventType.LOGOUT,
      });
    });
  }

  async me(orgId: string, userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    roles: AppRole[];
    isActive: boolean;
  }> {
    return this.prisma.withOrg(orgId, async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          orgId,
        },
        include: {
          roles: true,
        },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map((role) => role.role),
        isActive: user.isActive,
      };
    });
  }

  async listUsers(orgId: string): Promise<
    Array<{ id: string; email: string; fullName: string; roles: AppRole[]; isActive: boolean }>
  > {
    return this.prisma.withOrg(orgId, async (tx) => {
      const users = await tx.user.findMany({
        where: { orgId },
        include: { roles: true },
        orderBy: { createdAt: 'desc' },
      });

      return users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map((role) => role.role),
        isActive: user.isActive,
      }));
    });
  }

  async createUser(orgId: string, input: CreateUserDto): Promise<{ id: string }> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password);

    return this.prisma.withOrg(orgId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { orgId, email },
      });
      if (existing) {
        throw new BadRequestException('Email already exists in this organization');
      }

      const created = await tx.user.create({
        data: {
          orgId,
          email,
          fullName: input.fullName.trim(),
          passwordHash,
          isActive: input.isActive ?? true,
        },
      });

      await tx.userRole.createMany({
        data: input.roles.map((role) => ({
          userId: created.id,
          orgId,
          role,
        })),
      });

      return { id: created.id };
    });
  }

  async updateUserRoles(orgId: string, userId: string, input: UpdateUserRolesDto): Promise<void> {
    await this.prisma.withOrg(orgId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, orgId },
      });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      await tx.userRole.deleteMany({
        where: { userId, orgId },
      });
      await tx.userRole.createMany({
        data: input.roles.map((role) => ({
          userId,
          orgId,
          role,
        })),
      });
    });
  }

  async updateUserActive(orgId: string, userId: string, isActive: boolean): Promise<void> {
    await this.prisma.withOrg(orgId, async (tx) => {
      await tx.user.updateMany({
        where: { id: userId, orgId },
        data: { isActive },
      });
      if (!isActive) {
        await tx.authSession.updateMany({
          where: {
            orgId,
            userId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }
    });
  }

  private signAccessToken(payload: JwtPayload): string {
    const accessTtlSeconds = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? '900');
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      expiresIn: accessTtlSeconds,
    });
  }

  private signRefreshToken(payload: JwtPayload): string {
    const refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '14');
    const refreshTtlSeconds = refreshTtlDays * 24 * 60 * 60;
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      expiresIn: refreshTtlSeconds,
    });
  }

  private verifyRefreshToken(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const appBaseUrl = process.env.APP_WEB_URL?.trim() || 'http://localhost:3000';
    const resetUrl = `${appBaseUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(token)}`;
    const fromEmail = process.env.AUTH_FROM_EMAIL?.trim() || process.env.CONTRACTS_FROM_EMAIL?.trim();
    const resendApiKey = process.env.RESEND_API_KEY?.trim();

    if (!fromEmail) {
      throw new ServiceUnavailableException('Missing AUTH_FROM_EMAIL or CONTRACTS_FROM_EMAIL');
    }

    if (!resendApiKey) {
      if (process.env.NODE_ENV !== 'production') {
        // Helpful for local validation when email provider is not configured.
        // eslint-disable-next-line no-console
        console.info(`[auth] Password reset token for ${email}: ${resetUrl}`);
        return;
      }
      throw new ServiceUnavailableException('Missing RESEND_API_KEY');
    }

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Restablecer contrasena',
      text: `Recibimos una solicitud para restablecer tu contrasena.\n\nUsa este enlace:\n${resetUrl}\n\nSi no fuiste tu, ignora este correo.`,
      html: `<p>Recibimos una solicitud para restablecer tu contrasena.</p><p><a href="${resetUrl}">Restablecer contrasena</a></p><p>Si no fuiste tu, ignora este correo.</p>`,
    });
  }

  private async createAuthEvent(
    tx: Prisma.TransactionClient,
    input: {
      orgId: string;
      userId?: string;
      email?: string;
      eventType: AuthEventType;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.authEvent.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        email: input.email,
        eventType: input.eventType,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      },
    });
  }
}
