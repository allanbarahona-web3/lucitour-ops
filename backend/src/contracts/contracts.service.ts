import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ContractDocumentType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SendContractPdfDto } from './dto/send-contract-pdf.dto';
import { UploadContractDocumentDto } from './dto/upload-contract-document.dto';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private static toHtml(messageText: string): string {
    return messageText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(
        (line) =>
          `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`,
      )
      .join('');
  }

  async sendContractPdf(payload: SendContractPdfDto): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey) {
      throw new ServiceUnavailableException('Missing RESEND_API_KEY');
    }

    const fromEmail = process.env.CONTRACTS_FROM_EMAIL?.trim();
    if (!fromEmail) {
      throw new ServiceUnavailableException('Missing CONTRACTS_FROM_EMAIL');
    }

    const resend = new Resend(resendApiKey);

    try {
      await resend.emails.send({
        from: fromEmail,
        to: [payload.to],
        subject: payload.subject,
        text: payload.messageText,
        html: ContractsService.toHtml(payload.messageText),
        attachments: [
          {
            filename: payload.fileName,
            content: payload.pdfBase64,
          },
        ],
      });
    } catch {
      throw new BadGatewayException('Unable to send email with contract PDF attachment');
    }
  }

  async uploadDocument(orgId: string, contractId: string, payload: UploadContractDocumentDto) {
    this.logger.log(
      `[documents] upload:start org=${orgId} contractId=${contractId} type=${payload.type} file=${payload.fileName}`,
    );

    try {
      const objectKey = this.buildDocumentObjectKey(orgId, contractId, payload.type);
      const upload = await this.storage.putBase64({
        objectKey,
        base64: payload.fileBase64,
        contentType: payload.contentType,
        optimizeImagesToWebp: true,
      });

      const result = await this.prisma.withOrg(orgId, async (tx) => {
        const created = await tx.contractDocument.create({
          data: {
            orgId,
            contractId,
            type: payload.type,
            objectKey: upload.objectKey,
            originalName: payload.fileName,
            ownerName: payload.ownerName,
            concept: payload.concept,
            conceptOther: payload.conceptOther,
            contentType: upload.contentType,
            sizeBytes: upload.sizeBytes,
            sha256: upload.sha256,
            uploadedByUserId: payload.uploadedByUserId,
          },
        });

        return {
          ...created,
          downloadUrl: await this.storage.getSignedDownloadUrl(created.objectKey),
        };
      });

      this.logger.log(
        `[documents] upload:success org=${orgId} contractId=${contractId} type=${payload.type} objectKey=${result.objectKey}`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[documents] upload:error org=${orgId} contractId=${contractId} type=${payload.type} message=${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async listDocuments(orgId: string, contractId: string) {
    return this.prisma.withOrg(orgId, async (tx) => {
      const documents = await tx.contractDocument.findMany({
        where: {
          orgId,
          contractId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const items = await Promise.all(
        documents.map(async (document) => ({
          ...document,
          downloadUrl: await this.storage.getSignedDownloadUrl(document.objectKey),
        })),
      );

      this.logger.log(
        `[documents] list org=${orgId} contractId=${contractId} count=${items.length}`,
      );
      return items;
    });
  }

  private buildDocumentObjectKey(
    orgId: string,
    contractId: string,
    type: ContractDocumentType,
  ): string {
    const safeOrgId = orgId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeContractId = contractId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `contracts/${safeOrgId}/${safeContractId}/docs/${type.toLowerCase()}-${randomUUID()}`;
  }
}
