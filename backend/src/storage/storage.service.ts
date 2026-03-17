import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

interface PutBase64Input {
  objectKey: string;
  base64: string;
  contentType: string;
}

interface PutBase64Output {
  objectKey: string;
  sizeBytes: number;
  sha256: string;
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
    const body = Buffer.from(normalizedBase64, 'base64');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        Body: body,
        ContentType: input.contentType,
      }),
    );

    return {
      objectKey: input.objectKey,
      sizeBytes: body.byteLength,
      sha256: createHash('sha256').update(body).digest('hex'),
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
}
