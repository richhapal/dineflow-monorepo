import { Module } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { AvailabilityService } from './availability.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, WebsocketModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsService, AvailabilityService],
  exports: [RestaurantsService, AvailabilityService],
})
export class RestaurantsModule {}
