import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

interface SharpPipeline {
  rotate(): SharpPipeline;
  webp(options: { quality: number; effort: number }): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

type SharpFactory = (input: Buffer) => SharpPipeline;

interface PutBase64Input {
  objectKey: string;
  base64: string;
  contentType: string;
  optimizeImagesToWebp?: boolean;
}

interface PutBase64Output {
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  contentType: string;
}

@Injectable()
export class StorageService {
  private readonly bucket = process.env.DO_SPACES_BUCKET?.trim();
  private readonly publicBaseUrl = process.env.DO_SPACES_CDN_BASE_URL?.trim();

  private readonly s3 = new S3Client({
    region: process.env.DO_SPACES_REGION?.trim() || 'us-east-1',
    endpoint: process.env.DO_SPACES_ENDPOINT?.trim(),
    forcePathStyle: false,
    credentials:
      process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET
        ? {
            accessKeyId: process.env.DO_SPACES_KEY,
            secretAccessKey: process.env.DO_SPACES_SECRET,
          }
        : undefined,
  });

  async putBase64(input: PutBase64Input): Promise<PutBase64Output> {
    const bucket = this.requireBucket();
    const normalizedBase64 = this.normalizeBase64(input.base64);
    const originalBody = Buffer.from(normalizedBase64, 'base64');

    const { body, contentType } = await this.maybeOptimizeImageToWebp({
      body: originalBody,
      contentType: input.contentType,
      optimize: input.optimizeImagesToWebp === true,
    });

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );

    return {
      objectKey: input.objectKey,
      sizeBytes: body.byteLength,
      sha256: createHash('sha256').update(body).digest('hex'),
      contentType,
    };
  }

  async getSignedDownloadUrl(
    objectKey: string,
    expiresSeconds = 900,
  ): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
    }

    const bucket = this.requireBucket();
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
      { expiresIn: expiresSeconds },
    );
  }

  private requireBucket(): string {
    if (!this.bucket) {
      throw new ServiceUnavailableException('Missing DO_SPACES_BUCKET');
    }
    return this.bucket;
  }

  private normalizeBase64(input: string): string {
    const value = input.trim();
    const marker = ';base64,';
    const markerIndex = value.indexOf(marker);
    if (markerIndex >= 0) {
      return value.slice(markerIndex + marker.length);
    }
    return value;
  }

  private async maybeOptimizeImageToWebp(input: {
    body: Buffer;
    contentType: string;
    optimize: boolean;
  }): Promise<{ body: Buffer; contentType: string }> {
    if (!input.optimize) {
      return {
        body: input.body,
        contentType: input.contentType,
      };
    }

    const normalizedType = input.contentType.trim().toLowerCase();
    const canConvert =
      normalizedType === 'image/jpeg' || normalizedType === 'image/png';
    if (!canConvert) {
      return {
        body: input.body,
        contentType: input.contentType,
      };
    }

    const rawQuality = Number.parseInt(
      process.env.IMAGE_WEBP_QUALITY?.trim() || '',
      10,
    );
    const quality = Number.isFinite(rawQuality)
      ? Math.min(95, Math.max(45, rawQuality))
      : 78;

    const sharpModule = (await import('sharp')) as unknown as {
      default: SharpFactory;
    };
    const sharpFactory = sharpModule.default;

    const webp = await sharpFactory(input.body)
      .rotate()
      .webp({ quality, effort: 4 })
      .toBuffer();

    if (webp.byteLength >= input.body.byteLength) {
      return {
        body: input.body,
        contentType: input.contentType,
      };
    }

    return {
      body: webp,
      contentType: 'image/webp',
    };
  }
}
