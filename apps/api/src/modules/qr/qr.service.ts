import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQRDto, BulkCreateQRDto } from './dto/create-qr.dto';
import * as QRCodeLib from 'qrcode';

@Injectable()
export class QrService {
  private readonly menuBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.menuBaseUrl = this.config.get<string>('MENU_BASE_URL') || 'http://localhost:3001';
  }

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

  async generateQRImage(idOrSlug: string): Promise<{ qr_image: string; url: string }> {
    // Accept either cuid (id) or slug
    const qr = await this.prisma.qRCode.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!qr) throw new NotFoundException('QR code not found');

    const scanUrl = `${this.menuBaseUrl}/m/${qr.slug}`;

    // Generate PNG as base64 (without data URL prefix)
    const dataUrl: string = await QRCodeLib.toDataURL(scanUrl, {
      type: 'image/png',
      margin: 2,
      width: 400,
      color: { dark: '#000000', light: '#ffffff' },
    });
    // Strip "data:image/png;base64," prefix — frontend builds it back
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    return { qr_image: base64, url: scanUrl };
  }

  async bulkCreate(dto: BulkCreateQRDto, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // ── New format: tableIds[] ─────────────────────────────────────────────
    if (dto.tableIds && dto.tableIds.length > 0) {
      const tables = await this.prisma.restaurantTable.findMany({
        where: { id: { in: dto.tableIds }, restaurant_id: restaurantId },
      });

      const qrs = await this.prisma.$transaction(
        tables.map((table) => {
          const slug = `${restaurant.slug}-${this.slugify(table.name)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          return this.prisma.qRCode.create({
            data: {
              restaurant_id: restaurantId,
              table_id: table.id,
              label: table.name,
              slug,
            },
          });
        }),
      );
      return qrs;
    }

    // ── Legacy format: count + prefix ─────────────────────────────────────
    const count = dto.count ?? 1;
    const prefix = dto.prefix ?? 'Table';
    const qrs = await this.prisma.$transaction(
      Array.from({ length: count }, (_, i) => {
        const label = `${prefix} ${i + 1}`;
        const slug = `${restaurant.slug}-${this.slugify(prefix)}-${i + 1}-${Date.now() + i}`;
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
