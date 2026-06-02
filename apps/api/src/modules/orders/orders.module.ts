import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderQueueService } from './order-queue.service';
import { OrderQueueProcessor } from './order-queue.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    PrismaModule,
    WebsocketModule,
    RestaurantsModule,
    BullModule.registerQueue({ name: 'orders' }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderQueueService, OrderQueueProcessor],
  exports: [OrdersService, OrderQueueService],
})
export class OrdersModule {}
