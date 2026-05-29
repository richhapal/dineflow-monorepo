import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { MenuProcessor } from './menu.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    PrismaModule,
    RestaurantsModule,
    BullModule.registerQueue({ name: 'translations' }),
  ],
  controllers: [MenuController],
  providers: [MenuService, MenuProcessor],
  exports: [MenuService],
})
export class MenuModule {}
