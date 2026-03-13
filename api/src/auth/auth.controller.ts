import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { requireOrgId } from '../common/get-org-id';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserActiveDto } from './dto/update-user-active.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { JwtPayload } from './types/jwt-payload.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getUserAgent(request: Request): string | undefined {
    const userAgent = request.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(' | ') : userAgent;
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Body() payload: LoginDto,
    @Req() request: Request,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.authService.login(orgId, payload, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request),
    });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Body() payload: RefreshTokenDto,
    @Req() request: Request,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.authService.refresh(orgId, payload.refreshToken, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request),
    });
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Body() payload: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const orgId = requireOrgId(orgIdHeader);
    await this.authService.requestPasswordReset(orgId, payload.email, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request),
    });
    return { ok: true };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Body() payload: ResetPasswordDto,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const orgId = requireOrgId(orgIdHeader);
    await this.authService.resetPassword(orgId, payload.token, payload.newPassword, {
      ipAddress: request.ip,
      userAgent: this.getUserAgent(request),
    });
    return { ok: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ ok: true }> {
    const orgId = requireOrgId(orgIdHeader);
    await this.authService.logout(orgId, user.sub);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.authService.me(orgId, user.sub);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  async listUsers(@Headers('x-org-id') orgIdHeader: string | undefined) {
    const orgId = requireOrgId(orgIdHeader);
    return this.authService.listUsers(orgId);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  async createUser(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Body() payload: CreateUserDto,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.authService.createUser(orgId, payload);
  }

  @Patch('users/:userId/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  async updateUserRoles(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('userId') userId: string,
    @Body() payload: UpdateUserRolesDto,
  ): Promise<{ ok: true }> {
    const orgId = requireOrgId(orgIdHeader);
    await this.authService.updateUserRoles(orgId, userId, payload);
    return { ok: true };
  }

  @Patch('users/:userId/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  async updateUserActive(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('userId') userId: string,
    @Body() payload: UpdateUserActiveDto,
  ): Promise<{ ok: true }> {
    const orgId = requireOrgId(orgIdHeader);
    await this.authService.updateUserActive(orgId, userId, payload.isActive);
    return { ok: true };
  }
}
