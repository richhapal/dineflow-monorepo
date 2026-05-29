import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateItemDto, UpdateItemDto } from './dto/create-item.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { AvailabilityService } from '../restaurants/availability.service';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    @InjectQueue('translations') private readonly translationsQueue: Queue,
  ) {}

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  async getCategories(restaurantId: string, lang?: string) {
    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurant_id: restaurantId, deleted_at: null },
      include: {
        translations: lang ? { where: { lang_code: lang as any } } : false,
        menuItems: {
          where: { deleted_at: null, is_available: true },
          include: {
            variants: true,
            translations: lang ? { where: { lang_code: lang as any } } : false,
          },
          orderBy: { sort_order: 'asc' },
        },
      },
      orderBy: { sort_order: 'asc' },
    });
    return categories;
  }

  async getItems(restaurantId: string, categoryId?: string, lang?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        restaurant_id: restaurantId,
        deleted_at: null,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      include: {
        variants: true,
        addonGroups: { include: { addons: true } },
        translations: lang ? { where: { lang_code: lang as any } } : true,
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto, restaurantId: string) {
    return this.prisma.menuCategory.create({
      data: { restaurant_id: restaurantId, ...dto },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, restaurantId: string) {
    await this.assertCategoryOwnership(id, restaurantId);
    return this.prisma.menuCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string, restaurantId: string) {
    await this.assertCategoryOwnership(id, restaurantId);
    // Soft-delete the category and all its items in a transaction
    await this.prisma.$transaction([
      this.prisma.menuItem.updateMany({
        where: { category_id: id, restaurant_id: restaurantId, deleted_at: null },
        data: { deleted_at: new Date() },
      }),
      this.prisma.menuCategory.update({
        where: { id },
        data: { deleted_at: new Date() },
      }),
    ]);
    return { deleted: true };
  }

  async reorderCategories(ids: string[], restaurantId: string) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuCategory.update({
          where: { id, restaurant_id: restaurantId },
          data: { sort_order: index },
        }),
      ),
    );
    return { reordered: true };
  }

  // ── ITEMS ─────────────────────────────────────────────────────────────────

  async createItem(dto: CreateItemDto, restaurantId: string) {
    const item = await this.prisma.menuItem.create({
      data: {
        restaurant_id: restaurantId,
        category_id: dto.category_id,
        name: dto.name,
        description: dto.description,
        base_price: dto.base_price,
        food_type: dto.food_type as any,
        tags: dto.tags || [],
        allergens: dto.allergens || [],
        calories: dto.calories,
        prep_time_mins: dto.prep_time_mins,
        is_available: dto.is_available ?? true,
        is_featured: dto.is_featured ?? false,
        is_bestseller: dto.is_bestseller ?? false,
        sort_order: dto.sort_order ?? 0,
      },
    });

    // Enqueue translation job (non-fatal — Redis may not be running in dev)
    this.translationsQueue.add('translate-item', {
      itemId: item.id,
      restaurantId,
    }).catch((err: Error) => {
      console.warn('[Menu] Translation queue unavailable, skipping:', err.message);
    });

    return item;
  }

  async getItem(id: string, restaurantId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
      include: { variants: true, addonGroups: { include: { addons: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async updateItem(id: string, dto: UpdateItemDto, restaurantId: string) {
    await this.assertItemOwnership(id, restaurantId);

    const { variants, ...itemFields } = dto;

    // ── Variants upsert ───────────────────────────────────────────────────────
    if (variants !== undefined) {
      // IDs sent from the client that are real cuid (not "new-*" temp ids)
      const existingIds = variants
        .map(v => v.id)
        .filter((vid): vid is string => !!vid && !vid.startsWith('new-'));

      // Delete variants that were removed (in DB but not in the payload)
      await this.prisma.menuItemVariant.deleteMany({
        where: { item_id: id, id: { notIn: existingIds } },
      });

      // Upsert each variant in order
      for (const v of variants) {
        const isNew = !v.id || v.id.startsWith('new-');
        const data = {
          name: v.name,
          price: v.price,
          is_default: v.is_default ?? false,
          is_available: v.is_available ?? true,
          sort_order: v.sort_order ?? 0,
        };
        if (isNew) {
          await this.prisma.menuItemVariant.create({ data: { ...data, item_id: id } });
        } else {
          await this.prisma.menuItemVariant.update({ where: { id: v.id }, data });
        }
      }
    }

    // ── Item fields ────────────────────────────────────────────────────────────
    return this.prisma.menuItem.update({
      where: { id },
      data: itemFields as any,
      include: { variants: { orderBy: { sort_order: 'asc' } } },
    });
  }

  async toggleAvailability(id: string, restaurantId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
    });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.menuItem.update({
      where: { id },
      data: { is_available: !item.is_available },
    });
  }

  async deleteItem(id: string, restaurantId: string) {
    await this.assertItemOwnership(id, restaurantId);
    return this.prisma.menuItem.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async getTranslations(itemId: string, restaurantId: string) {
    await this.assertItemOwnership(itemId, restaurantId);
    return this.prisma.menuItemTranslation.findMany({ where: { item_id: itemId } });
  }

  async updateTranslation(
    itemId: string,
    langCode: string,
    dto: UpdateTranslationDto,
    restaurantId: string,
  ) {
    await this.assertItemOwnership(itemId, restaurantId);
    return this.prisma.menuItemTranslation.upsert({
      where: { item_id_lang_code: { item_id: itemId, lang_code: langCode as any } },
      create: { item_id: itemId, lang_code: langCode as any, ...dto, is_ai: false },
      update: { ...dto, is_ai: false },
    });
  }

  async getPublicMenu(slug: string, lang?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo_public_id: true,
        theme_config: true,
        default_language: true,
        enabled_languages: true,
        is_ordering_enabled: true,
        ordering_mode: true,
        timezone: true,
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const effectiveLang = lang || restaurant.default_language;

    const [availability, categories, collections] = await Promise.all([
      this.availabilityService.checkAvailability(slug),
      this.prisma.menuCategory.findMany({
        where: { restaurant_id: restaurant.id, deleted_at: null, is_active: true },
        include: {
          translations: { where: { lang_code: effectiveLang as any } },
          menuItems: {
            where: { deleted_at: null, is_available: true },
            include: {
              variants: { where: { is_available: true } },
              addonGroups: { include: { addons: { where: { is_available: true } } } },
              translations: { where: { lang_code: effectiveLang as any } },
            },
            orderBy: { sort_order: 'asc' },
          },
        },
        orderBy: { sort_order: 'asc' },
      }),
      this.prisma.menuCollection.findMany({
        where: { restaurant_id: restaurant.id, is_active: true, display_on_menu: true },
        include: {
          items: {
            include: { menuItem: { include: { translations: { where: { lang_code: effectiveLang as any } } } } },
            orderBy: { sort_order: 'asc' },
          },
          translations: { where: { lang_code: effectiveLang as any } },
        },
        orderBy: { sort_order: 'asc' },
      }),
    ]);

    return { restaurant, availability, categories, collections, lang: effectiveLang };
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  private async assertCategoryOwnership(id: string, restaurantId: string) {
    const cat = await this.prisma.menuCategory.findFirst({
      where: { id, restaurant_id: restaurantId },
    });
    if (!cat) throw new NotFoundException('Category not found');
  }

  private async assertItemOwnership(id: string, restaurantId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
    });
    if (!item) throw new NotFoundException('Item not found');
  }
}
