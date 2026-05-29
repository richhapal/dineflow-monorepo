import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const accountId = config.getOrThrow('R2_ACCOUNT_ID');
    this.bucket = config.getOrThrow('R2_BUCKET');
    this.publicBaseUrl = config.getOrThrow('R2_PUBLIC_BASE_URL').replace(/\/$/, '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.getOrThrow('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  // ── Validation + compression ──────────────────────────────────────────────────
  // Multer already filters by MIME type. Sharp validates the actual image bytes
  // and throws on corrupt/non-image files — no need for the ESM-only file-type pkg.
  private async validateAndCompress(file: Express.Multer.File): Promise<Buffer> {
    try {
      return await sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid image file — only JPEG, PNG or WebP are allowed');
    }
  }

  // ── Core upload — deterministic key means re-upload always overwrites ─────────
  private async putObject(key: string, buffer: Buffer): Promise<string> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return key; // store the key as public_id in DB
  }

  // ── Delete a specific object ───────────────────────────────────────────────────
  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Silently ignore — object may already be gone
    }
  }

  // ── Public URL builder ────────────────────────────────────────────────────────
  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  // ── Menu item image ───────────────────────────────────────────────────────────
  // Key includes a timestamp so every upload gets a unique URL — this is the only
  // reliable way to avoid browser/CDN/Next.js image-cache serving stale content
  // when the same item's image is replaced.
  async uploadMenuItemImage(
    file: Express.Multer.File,
    restaurantId: string,
    itemId: string,
  ): Promise<{ key: string; url: string }> {
    const buffer = await this.validateAndCompress(file);
    const key = `restaurants/${restaurantId}/items/${itemId}_${Date.now()}.webp`;
    await this.putObject(key, buffer);
    return { key, url: this.publicUrl(key) };
  }

  // ── Restaurant logo ───────────────────────────────────────────────────────────
  async uploadRestaurantLogo(
    file: Express.Multer.File,
    restaurantId: string,
  ): Promise<{ key: string; url: string }> {
    const buffer = await this.validateAndCompress(file);
    const key = `restaurants/${restaurantId}/logo.webp`;
    await this.putObject(key, buffer);
    return { key, url: this.publicUrl(key) };
  }

  // ── UPI QR code ───────────────────────────────────────────────────────────────
  async uploadUPIQR(
    file: Express.Multer.File,
    restaurantId: string,
  ): Promise<{ key: string; url: string }> {
    const buffer = await this.validateAndCompress(file);
    const key = `restaurants/${restaurantId}/upi-qr.webp`;
    await this.putObject(key, buffer);
    return { key, url: this.publicUrl(key) };
  }
}
