import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { OrderQueueService, QueuedOrder } from './order-queue.service';

@Processor('orders')
export class OrderQueueProcessor {
  private readonly logger = new Logger(OrderQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WebsocketGateway,
    private readonly queueService: OrderQueueService,
  ) {}

  @Process('process-order')
  async handleProcessOrder(job: Job<QueuedOrder>): Promise<void> {
    const { orderId, restaurantId, sessionId, queuePosition } = job.data;

    this.logger.log(`Processing order ${sessionId} (pos ${queuePosition}) for restaurant ${restaurantId}`);

    try {
      // Mark order as confirmed in DB
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED', confirmed_at: new Date() },
      });

      // Create status history entry
      await this.prisma.orderStatusHistory.create({
        data: {
          order_id: orderId,
          status: 'CONFIRMED',
          changed_by: 'system_queue',
          notes: `Auto-confirmed via queue position ${queuePosition}`,
        },
      });

      // Emit WebSocket: order confirmed
      this.gateway.emitOrderStatus(restaurantId, orderId, 'CONFIRMED');

      // Decrement queue counter
      await this.queueService.dequeueOrder(restaurantId);

      // Notify dashboard of updated queue
      const updatedQueue = await this.queueService.getQueueForDashboard(restaurantId);
      this.gateway.emitQueueUpdate(restaurantId, updatedQueue);

      this.logger.log(`Order ${sessionId} confirmed and dequeued`);
    } catch (err) {
      this.logger.error(`Failed to process order ${sessionId}`, err);
      throw err; // allow BullMQ retry
    }
  }

  @Process('order-timeout')
  async handleOrderTimeout(job: Job<{ orderId: string; restaurantId: string; timeoutMinutes: number }>): Promise<void> {
    const { orderId, restaurantId, timeoutMinutes } = job.data;

    this.logger.log(`Timeout check for order ${orderId} (${timeoutMinutes}min)`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true, customer_name: true },
      });

      // Only auto-cancel if still PENDING — if already confirmed/declined, no-op
      if (!order || order.status !== 'PENDING') {
        this.logger.log(`Order ${orderId} already handled (status: ${order?.status}) — skipping timeout`);
        return;
      }

      const reason = `Not accepted within ${timeoutMinutes} minutes — auto-cancelled`;

      // Cancel the order
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', decline_reason: reason },
      });

      // Create status history entry
      await this.prisma.orderStatusHistory.create({
        data: {
          order_id: orderId,
          status: 'CANCELLED',
          changed_by: 'system_auto',
          notes: reason,
        },
      });

      // Emit to kitchen/dashboard
      this.gateway.emitOrderStatus(restaurantId, orderId, 'CANCELLED');
      // Emit with reason to customer's order room
      this.gateway.emitOrderDeclined(orderId, reason);

      // Update queue
      await this.queueService.dequeueOrder(restaurantId);
      const updatedQueue = await this.queueService.getQueueForDashboard(restaurantId);
      this.gateway.emitQueueUpdate(restaurantId, updatedQueue);

      this.logger.log(`Order ${orderId} auto-cancelled after ${timeoutMinutes}min timeout`);
    } catch (err) {
      this.logger.error(`Failed to process timeout for order ${orderId}`, err);
    }
  }
}
