import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [PrismaModule, WebsocketModule, RestaurantsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
