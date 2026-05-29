import {
  Controller, Post, Param, UploadedFile,
  UseInterceptors, UseGuards, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException('Images only (JPG, PNG, WebP)'), false);
  },
};

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload (or replace) a menu item image.
   * The key is deterministic → same URL on every re-upload, old file overwritten automatically.
   */
  @Post('menu-item/:itemId/image')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  async uploadItemImage(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    // Verify item belongs to this restaurant and grab the old image key for cleanup
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, restaurant_id: user.restaurant_id, deleted_at: null },
      select: { id: true, image_public_id: true },
    });
    if (!item) throw new BadRequestException('Item not found');

    // Upload new image — key includes timestamp so URL is always unique
    const { key, url } = await this.uploadService.uploadMenuItemImage(
      file, user.restaurant_id, itemId,
    );

    // Persist new key in DB
    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { image_public_id: key },
      select: { id: true, image_public_id: true, category_id: true },
    });

    // Delete old R2 object after DB is updated — fire-and-forget, non-fatal
    if (item.image_public_id && item.image_public_id !== key) {
      this.uploadService.deleteObject(item.image_public_id).catch((err: Error) =>
        console.warn('[Upload] Failed to delete old image:', err.message),
      );
    }

    return { public_id: updated.image_public_id, url, category_id: updated.category_id };
  }

  /**
   * Upload (or replace) the restaurant logo.
   */
  @Post('restaurant/logo')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  async uploadLogo(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const { key, url } = await this.uploadService.uploadRestaurantLogo(
      file, user.restaurant_id,
    );

    await this.prisma.restaurant.update({
      where: { id: user.restaurant_id },
      data: { logo_public_id: key },
    });

    return { public_id: key, url };
  }

  /**
   * Upload (or replace) the UPI QR code image.
   */
  @Post('restaurant/upi-qr')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  async uploadUPIQR(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const { key, url } = await this.uploadService.uploadUPIQR(
      file, user.restaurant_id,
    );

    return { public_id: key, url };
  }
}
