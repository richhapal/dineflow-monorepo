import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { BillingModule } from './modules/billing/billing.module';
import { StaffModule } from './modules/staff/staff.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { QrModule } from './modules/qr/qr.module';
import { UploadModule } from './modules/upload/upload.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TablesModule } from './modules/tables/tables.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Config — loads .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Job queues (Redis via Upstash)
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    }),

    // Core
    PrismaModule,

    // Feature modules
    AuthModule,
    RestaurantsModule,
    MenuModule,
    OrdersModule,
    BillingModule,
    StaffModule,
    InventoryModule,
    AnalyticsModule,
    QrModule,
    UploadModule,
    WebsocketModule,
    NotificationsModule,
    TablesModule,
  ],
})
export class AppModule {}
