import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQRDto, BulkCreateQRDto } from './dto/create-qr.dto';

// qrcode package — install if not present (it IS in many NestJS setups)
// If not available, use a placeholder
let QRCode: any;
try { QRCode = require('qrcode'); } catch { QRCode = null; }

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(str: string) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async createQRCode(dto: CreateQRDto, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const slug = dto.slug || `${restaurant.slug}-${this.slugify(dto.label)}-${Date.now()}`;

    return this.prisma.qRCode.create({
      data: {
        restaurant_id: restaurantId,
        table_id: dto.table_id,
        room_id: dto.room_id,
        label: dto.label,
        slug,
      },
    });
  }

  async getQRCodes(restaurantId: string) {
    return this.prisma.qRCode.findMany({
      where: { restaurant_id: restaurantId },
      include: { table: true, room: true, _count: { select: { scanLogs: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async logScan(slug: string, ip: string, userAgent: string, langCode: string) {
    const qr = await this.prisma.qRCode.findUnique({ where: { slug } });
    if (!qr || !qr.is_active) return null;

    await this.prisma.$transaction([
      this.prisma.qRCode.update({ where: { id: qr.id }, data: { scans: { increment: 1 } } }),
      this.prisma.qRScanLog.create({
        data: {
          qr_code_id: qr.id,
          ip_address: ip,
          user_agent: userAgent,
          lang_code: (langCode || 'en') as any,
        },
      }),
    ]);

    return qr;
  }

  async generateQRImage(slug: string): Promise<string> {
    const qr = await this.prisma.qRCode.findUnique({ where: { slug } });
    if (!qr) throw new NotFoundException('QR code not found');

    const url = `https://dineflow.app/m/${slug}`;

    if (!QRCode) {
      // Return placeholder if qrcode package not installed
      return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><text>${url}</text></svg>`).toString('base64')}`;
    }

    return QRCode.toDataURL(url, { type: 'image/png', margin: 2 });
  }

  async bulkCreate(dto: BulkCreateQRDto, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const qrs = await this.prisma.$transaction(
      Array.from({ length: dto.count }, (_, i) => {
        const label = `${dto.prefix} ${i + 1}`;
        const slug = `${restaurant.slug}-${this.slugify(dto.prefix)}-${i + 1}-${Date.now() + i}`;
        return this.prisma.qRCode.create({
          data: { restaurant_id: restaurantId, label, slug },
        });
      }),
    );

    return qrs;
  }

  async disable(id: string, restaurantId: string) {
    const qr = await this.prisma.qRCode.findFirst({ where: { id, restaurant_id: restaurantId } });
    if (!qr) throw new NotFoundException('QR code not found');
    return this.prisma.qRCode.update({ where: { id }, data: { is_active: false } });
  }

  async getPublicQRData(slug: string) {
    const qr = await this.prisma.qRCode.findUnique({
      where: { slug },
      include: {
        table: true,
        room: true,
        restaurant: {
          select: { id: true, name: true, slug: true, theme_config: true, default_language: true, enabled_languages: true, is_ordering_enabled: true },
        },
      },
    });
    if (!qr || !qr.is_active) throw new NotFoundException('QR code not found or inactive');
    return qr;
  }
}
