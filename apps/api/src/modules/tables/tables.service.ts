import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTableDto, BulkCreateTableDto, UpdateTableDto, UpdateTableStatusDto, TableType } from './dto/create-table.dto';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET ALL ───────────────────────────────────────────────────────────────

  async getTables(restaurantId: string) {
    const tables = await this.prisma.restaurantTable.findMany({
      where: { restaurant_id: restaurantId, is_active: true },
      include: {
        qrCodes: {
          where: { is_active: true },
          select: { id: true, label: true, slug: true, scans: true },
        },
        orders: {
          where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'PAID'] as any } },
          select: { id: true, status: true, total_amount: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return tables.map(t => ({
      ...t,
      qr_count: t.qrCodes.length,
      current_order: t.orders[0] ?? null,
    }));
  }

  // ── GET ONE ───────────────────────────────────────────────────────────────

  async getTable(id: string, restaurantId: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id, restaurant_id: restaurantId, is_active: true },
      include: {
        qrCodes: { where: { is_active: true } },
        orders: {
          where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'PAID'] as any } },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async createTable(dto: CreateTableDto, restaurantId: string) {
    // Check for duplicate name
    const existing = await this.prisma.restaurantTable.findFirst({
      where: { restaurant_id: restaurantId, name: dto.name, is_active: true },
    });
    if (existing) throw new ConflictException(`Table "${dto.name}" already exists`);

    const table = await this.prisma.restaurantTable.create({
      data: {
        restaurant_id: restaurantId,
        name: dto.name,
        section: dto.section,
        capacity: dto.capacity ?? 4,
        table_type: (dto.table_type ?? TableType.INDOOR) as any,
        notes: dto.notes,
      },
    });

    // Auto-generate QR if requested
    if (dto.generate_qr) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId }, select: { slug: true },
      });
      if (restaurant) {
        const slug = `${restaurant.slug}-${table.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        await this.prisma.qRCode.create({
          data: {
            restaurant_id: restaurantId,
            table_id: table.id,
            label: table.name,
            slug,
          },
        });
      }
    }

    return table;
  }

  // ── BULK CREATE ───────────────────────────────────────────────────────────

  async bulkCreateTables(dto: BulkCreateTableDto, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId }, select: { slug: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const tables: any[] = [];

    for (let i = 0; i < dto.count; i++) {
      const idx = dto.start_index + i;
      const name = `${dto.name_prefix}${idx}`;

      // Skip if name already exists
      const exists = await this.prisma.restaurantTable.findFirst({
        where: { restaurant_id: restaurantId, name },
      });
      if (exists) continue;

      const table = await this.prisma.restaurantTable.create({
        data: {
          restaurant_id: restaurantId,
          name,
          section: dto.section,
          capacity: dto.capacity ?? 4,
          table_type: (dto.table_type ?? TableType.INDOOR) as any,
        },
      });
      tables.push(table);

      if (dto.generate_qr) {
        const slug = `${restaurant.slug}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now() + i}`;
        await this.prisma.qRCode.create({
          data: { restaurant_id: restaurantId, table_id: table.id, label: name, slug },
        });
      }
    }

    return tables;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async updateTable(id: string, dto: UpdateTableDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);

    // Check name uniqueness if changing name
    if (dto.name) {
      const conflict = await this.prisma.restaurantTable.findFirst({
        where: { restaurant_id: restaurantId, name: dto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Table "${dto.name}" already exists`);
    }

    return this.prisma.restaurantTable.update({
      where: { id },
      data: { ...dto, table_type: dto.table_type as any },
    });
  }

  // ── UPDATE STATUS ─────────────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateTableStatusDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: { status: dto.status as any },
    });
  }

  // ── DELETE (soft) ─────────────────────────────────────────────────────────

  async deleteTable(id: string, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    await this.prisma.restaurantTable.update({
      where: { id },
      data: { is_active: false },
    });
    return { deleted: true };
  }

  // ── SECTIONS ──────────────────────────────────────────────────────────────

  async getSections(restaurantId: string) {
    const tables = await this.prisma.restaurantTable.findMany({
      where: { restaurant_id: restaurantId, is_active: true, section: { not: null } },
      select: { section: true },
      distinct: ['section'],
    });
    return tables.map(t => t.section).filter(Boolean);
  }

  // ── HELPER ────────────────────────────────────────────────────────────────

  private async assertOwnership(id: string, restaurantId: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id, restaurant_id: restaurantId },
    });
    if (!table) throw new NotFoundException('Table not found');
  }
}
