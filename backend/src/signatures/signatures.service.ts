import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  SignatureActorType,
  SignatureEventType,
  SignatureRequestStatus,
} from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSignatureRequestDto } from './dto/create-signature-request.dto';
import { RequestSignatureOtpDto } from './dto/request-signature-otp.dto';
import { ReviewSignatureRequestDto } from './dto/review-signature-request.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';

const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;
const OTP_RESEND_COOLDOWN_SECONDS = 45;

@Injectable()
export class SignaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(orgId: string, payload: CreateSignatureRequestDto) {
    return this.prisma.withOrg(orgId, async (tx) => {
      const request = await tx.signatureRequest.create({
        data: {
          orgId,
          contractId: payload.contractId,
          recipientEmail: payload.recipientEmail,
          recipientName: payload.recipientName,
          contractFileName: payload.contractFileName,
          unsignedPdfBase64: payload.unsignedPdfBase64,
          status: SignatureRequestStatus.PENDING_OTP,
        },
      });

      await this.createEvent(tx, {
        orgId,
        signatureRequestId: request.id,
        type: SignatureEventType.REQUEST_CREATED,
        actorType: SignatureActorType.SYSTEM,
        metadata: {
          recipientEmail: payload.recipientEmail,
        },
      });

      return request;
    });
  }

  async requestOtp(orgId: string, requestId: string, payload: RequestSignatureOtpDto) {
    return this.prisma.withOrg(orgId, async (tx) => {
      const request = await tx.signatureRequest.findFirst({
        where: {
          id: requestId,
          orgId,
        },
      });

      if (!request) {
        throw new NotFoundException('Signature request not found');
      }

      if (
        request.status === SignatureRequestStatus.APPROVED ||
        request.status === SignatureRequestStatus.REJECTED
      ) {
        throw new UnprocessableEntityException('Cannot generate OTP for closed request');
      }

      const now = new Date();

      if (request.otpLockedUntil && request.otpLockedUntil > now) {
        throw new UnprocessableEntityException('OTP temporarily locked due to failed attempts');
      }

      if (request.otpSentAt) {
        const secondsSinceLastOtp = (now.getTime() - request.otpSentAt.getTime()) / 1000;
        if (secondsSinceLastOtp < OTP_RESEND_COOLDOWN_SECONDS) {
          throw new UnprocessableEntityException('OTP recently issued. Please wait before retrying');
        }
      }

      const otpCode = `${randomInt(100000, 999999)}`;
      const otpCodeHash = this.hashOtp(otpCode);

      await tx.signatureRequest.update({
        where: { id: request.id },
        data: {
          otpCodeHash,
          otpSentAt: now,
          otpAttemptCount: 0,
          otpLockedUntil: null,
          status: SignatureRequestStatus.PENDING_SIGNATURE,
        },
      });

      await this.createEvent(tx, {
        orgId,
        signatureRequestId: request.id,
        type: SignatureEventType.OTP_GENERATED,
        actorType: SignatureActorType.SYSTEM,
        metadata: {
          deliveryChannel: payload.deliveryChannel ?? 'email',
          destinationHint: payload.destinationHint ?? null,
        },
      });

      return {
        ok: true,
        requestId: request.id,
        otpCodePreview: process.env.NODE_ENV === 'production' ? undefined : otpCode,
      };
    });
  }

  async submitSignature(orgId: string, requestId: string, payload: SubmitSignatureDto) {
    return this.prisma.withOrg(orgId, async (tx) => {
      const request = await tx.signatureRequest.findFirst({
        where: {
          id: requestId,
          orgId,
        },
      });

      if (!request) {
        throw new NotFoundException('Signature request not found');
      }

      if (!request.otpCodeHash) {
        throw new UnprocessableEntityException('OTP has not been generated for this request');
      }

      const now = new Date();

      if (request.otpLockedUntil && request.otpLockedUntil > now) {
        throw new UnprocessableEntityException('OTP temporarily locked due to failed attempts');
      }

      if (request.otpCodeHash !== this.hashOtp(payload.otpCode)) {
        const nextAttemptCount = request.otpAttemptCount + 1;
        const lockUntil =
          nextAttemptCount >= OTP_MAX_ATTEMPTS
            ? new Date(now.getTime() + OTP_LOCK_MINUTES * 60 * 1000)
            : null;

        await tx.signatureRequest.update({
          where: {
            id: request.id,
          },
          data: {
            otpAttemptCount: nextAttemptCount,
            otpLockedUntil: lockUntil,
          },
        });

        await this.createEvent(tx, {
          orgId,
          signatureRequestId: request.id,
          type: SignatureEventType.OTP_FAILED,
          actorType: SignatureActorType.CLIENT,
          metadata: {
            reason: 'invalid_otp',
            attemptCount: nextAttemptCount,
            lockedUntil: lockUntil?.toISOString() ?? null,
          },
        });

        throw new BadRequestException('Invalid OTP code');
      }

      const updated = await tx.signatureRequest.update({
        where: {
          id: request.id,
        },
        data: {
          signatureImageBase64: payload.signatureImageBase64,
          otpAttemptCount: 0,
          otpLockedUntil: null,
          otpValidatedAt: now,
          submittedAt: now,
          status: SignatureRequestStatus.PENDING_REVIEW,
        },
      });

      await this.createEvent(tx, {
        orgId,
        signatureRequestId: request.id,
        type: SignatureEventType.SIGNATURE_SUBMITTED,
        actorType: SignatureActorType.CLIENT,
        metadata: {
          clientDeviceInfo: payload.clientDeviceInfo ?? null,
        },
      });

      return updated;
    });
  }

  async reviewRequest(orgId: string, requestId: string, payload: ReviewSignatureRequestDto) {
    return this.prisma.withOrg(orgId, async (tx) => {
      const request = await tx.signatureRequest.findFirst({
        where: {
          id: requestId,
          orgId,
        },
      });

      if (!request) {
        throw new NotFoundException('Signature request not found');
      }

      if (request.status !== SignatureRequestStatus.PENDING_REVIEW) {
        throw new UnprocessableEntityException('Request must be pending review before decision');
      }

      const now = new Date();

      if (payload.decision === 'approve') {
        const approved = await tx.signatureRequest.update({
          where: {
            id: request.id,
          },
          data: {
            reviewedByUserId: payload.reviewerUserId,
            approvedAt: now,
            status: SignatureRequestStatus.APPROVED,
            lucitoursSignatureImageBase64: payload.lucitoursSignatureImageBase64,
            signedPdfBase64: payload.signedPdfBase64,
          },
        });

        await this.createEvent(tx, {
          orgId,
          signatureRequestId: request.id,
          type: SignatureEventType.REQUEST_APPROVED,
          actorType: SignatureActorType.CONTRACTOR,
          actorId: payload.reviewerUserId,
        });

        return approved;
      }

      const rejected = await tx.signatureRequest.update({
        where: {
          id: request.id,
        },
        data: {
          reviewedByUserId: payload.reviewerUserId,
          rejectedAt: now,
          rejectionReason: payload.rejectionReason,
          status: SignatureRequestStatus.REJECTED,
        },
      });

      await this.createEvent(tx, {
        orgId,
        signatureRequestId: request.id,
        type: SignatureEventType.REQUEST_REJECTED,
        actorType: SignatureActorType.CONTRACTOR,
        actorId: payload.reviewerUserId,
        metadata: {
          rejectionReason: payload.rejectionReason ?? null,
        },
      });

      return rejected;
    });
  }

  async getRequest(orgId: string, requestId: string) {
    return this.prisma.withOrg(orgId, async (tx) => {
      const request = await tx.signatureRequest.findFirst({
        where: {
          id: requestId,
          orgId,
        },
        include: {
          events: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 30,
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Signature request not found');
      }

      return request;
    });
  }

  private hashOtp(otpCode: string): string {
    return createHash('sha256').update(otpCode).digest('hex');
  }

  private async createEvent(
    tx: Prisma.TransactionClient,
    input: {
      orgId: string;
      signatureRequestId: string;
      type: SignatureEventType;
      actorType: SignatureActorType;
      actorId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.signatureRequestEvent.create({
      data: {
        orgId: input.orgId,
        signatureRequestId: input.signatureRequestId,
        type: input.type,
        actorType: input.actorType,
        actorId: input.actorId,
        metadata: input.metadata,
      },
    });
  }
}
