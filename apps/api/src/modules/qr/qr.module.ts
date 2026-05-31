import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
