import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('translations')
export class MenuProcessor {
  private readonly logger = new Logger(MenuProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('translate-item')
  async translateItem(job: Job<{ itemId: string; restaurantId: string }>) {
    const { itemId, restaurantId } = job.data;

    // 1. Get item from DB
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, restaurant_id: restaurantId },
    });
    if (!item) return;

    // 2. Get restaurant's enabled_languages
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { enabled_languages: true },
    });
    if (!restaurant) return;

    // 3. Get existing translations to skip them
    const existing = await this.prisma.menuItemTranslation.findMany({
      where: { item_id: itemId },
      select: { lang_code: true },
    });
    const existingLangs = new Set(existing.map((t) => t.lang_code));

    // 4. For each language not yet translated — mock translation (TODO: integrate Google Translate)
    for (const lang of restaurant.enabled_languages) {
      if (lang === 'en' || existingLangs.has(lang)) continue;
      try {
        // TODO: Replace with actual Google Translate API call
        // const translatedName = await googleTranslate(item.name, lang);
        const translatedName = item.name; // placeholder — keeps English as fallback

        await this.prisma.menuItemTranslation.create({
          data: {
            item_id: itemId,
            lang_code: lang,
            name: translatedName,
            description: item.description ?? undefined,
            is_ai: true,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to translate item ${itemId} to ${lang}: ${err}`);
      }
    }
  }
}
