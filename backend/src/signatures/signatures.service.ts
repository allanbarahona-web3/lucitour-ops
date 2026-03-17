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
import { createHash, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSignatureRequestDto } from './dto/create-signature-request.dto';
import { RequestSignatureOtpDto } from './dto/request-signature-otp.dto';
import { ReviewSignatureRequestDto } from './dto/review-signature-request.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';

const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;
const OTP_RESEND_COOLDOWN_SECONDS = 45;

@Injectable()
export class SignaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createRequest(orgId: string, payload: CreateSignatureRequestDto) {
    const unsignedPdfUpload = payload.unsignedPdfBase64
      ? await this.storage.putBase64({
          objectKey: this.buildObjectKey(orgId, payload.contractId, 'unsigned', 'pdf'),
          base64: payload.unsignedPdfBase64,
          contentType: 'application/pdf',
        })
      : null;

    return this.prisma.withOrg(orgId, async (tx) => {
      const request = await tx.signatureRequest.create({
        data: {
          orgId,
          contractId: payload.contractId,
          recipientEmail: payload.recipientEmail,
          recipientName: payload.recipientName,
          contractFileName: payload.contractFileName,
          unsignedPdfObjectKey: unsignedPdfUpload?.objectKey,
          unsignedPdfSha256: unsignedPdfUpload?.sha256,
          unsignedPdfSizeBytes: unsignedPdfUpload?.sizeBytes,
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
    const signatureUpload = await this.storage.putBase64({
      objectKey: this.buildObjectKey(orgId, requestId, 'client-signature', 'png'),
      base64: payload.signatureImageBase64,
      contentType: 'image/png',
    });

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
          signatureImageObjectKey: signatureUpload.objectKey,
          signatureImageSha256: signatureUpload.sha256,
          signatureImageSizeBytes: signatureUpload.sizeBytes,
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
    const contractorSignatureUpload =
      payload.decision === 'approve' && payload.lucitoursSignatureImageBase64
        ? await this.storage.putBase64({
            objectKey: this.buildObjectKey(orgId, requestId, 'lucitours-signature', 'png'),
            base64: payload.lucitoursSignatureImageBase64,
            contentType: 'image/png',
          })
        : null;

    const signedPdfUpload =
      payload.decision === 'approve' && payload.signedPdfBase64
        ? await this.storage.putBase64({
            objectKey: this.buildObjectKey(orgId, requestId, 'signed', 'pdf'),
            base64: payload.signedPdfBase64,
            contentType: 'application/pdf',
          })
        : null;

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
            lucitoursSignatureObjectKey: contractorSignatureUpload?.objectKey,
            lucitoursSignatureSha256: contractorSignatureUpload?.sha256,
            lucitoursSignatureSizeBytes: contractorSignatureUpload?.sizeBytes,
            signedPdfObjectKey: signedPdfUpload?.objectKey,
            signedPdfSha256: signedPdfUpload?.sha256,
            signedPdfSizeBytes: signedPdfUpload?.sizeBytes,
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

      return {
        ...request,
        unsignedPdfUrl: request.unsignedPdfObjectKey
          ? await this.storage.getSignedDownloadUrl(request.unsignedPdfObjectKey)
          : null,
        signatureImageUrl: request.signatureImageObjectKey
          ? await this.storage.getSignedDownloadUrl(request.signatureImageObjectKey)
          : null,
        lucitoursSignatureUrl: request.lucitoursSignatureObjectKey
          ? await this.storage.getSignedDownloadUrl(request.lucitoursSignatureObjectKey)
          : null,
        signedPdfUrl: request.signedPdfObjectKey
          ? await this.storage.getSignedDownloadUrl(request.signedPdfObjectKey)
          : null,
      };
    });
  }

  private hashOtp(otpCode: string): string {
    return createHash('sha256').update(otpCode).digest('hex');
  }

  private buildObjectKey(orgId: string, contractOrRequestId: string, kind: string, ext: string): string {
    const safeOrgId = orgId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRef = contractOrRequestId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `contracts/${safeOrgId}/${safeRef}/${kind}-${randomUUID()}.${ext}`;
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
