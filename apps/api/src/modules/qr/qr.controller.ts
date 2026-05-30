import {
  Controller, Get, Post, Param, Body,
  Query, UseGuards, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QrService } from './qr.service';
import { CreateQRDto, BulkCreateQRDto } from './dto/create-qr.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('qr')
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get('scan/:slug')
  async scan(@Param('slug') slug: string, @Req() req: Request, @Query('lang') lang?: string) {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const ua = req.headers['user-agent'] || '';
    await this.qrService.logScan(slug, ip, ua, lang || 'en');
    return this.qrService.getPublicQRData(slug);
  }

  @Get()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getAll(@CurrentUser() user: any) {
    return this.qrService.getQRCodes(user.restaurant_id);
  }

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  create(@CurrentUser() user: any, @Body() dto: CreateQRDto) {
    return this.qrService.createQRCode(dto, user.restaurant_id);
  }

  @Post('bulk')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  bulkCreate(@CurrentUser() user: any, @Body() dto: BulkCreateQRDto) {
    return this.qrService.bulkCreate(dto, user.restaurant_id);
  }

  @Get(':id/image')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getImage(@Param('id') id: string) {
    // Returns { qr_image: string (pure base64), url: string (scan URL) }
    return this.qrService.generateQRImage(id);
  }

  @Post(':id/disable')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  disable(@CurrentUser() user: any, @Param('id') id: string) {
    return this.qrService.disable(id, user.restaurant_id);
  }
}
