import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface QueuedOrder {
  orderId: string;
  restaurantId: string;
  sessionId: string;       // ORD-4821 human-readable
  customerName: string;
  seatIdentifier: string;
  itemCount: number;
  totalAmount: number;
  queuePosition: number;
  placedAt: string;
}

@Injectable()
export class OrderQueueService {
  private readonly logger = new Logger(OrderQueueService.name);
  private redis: Redis;

  constructor(
    @InjectQueue('orders') private ordersQueue: Queue,
    config: ConfigService,
  ) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST') || 'localhost',
      port: parseInt(config.get<string>('REDIS_PORT') || '6379'),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
      // ─── Fail fast — never block a request waiting for Redis retries ───
      maxRetriesPerRequest: 1,   // was 3 → up to 14s of retry backoff
      connectTimeout: 3000,      // give up connecting after 3s
      commandTimeout: 2000,      // individual command timeout
      enableOfflineQueue: false,  // reject immediately if not connected (no queuing)
      retryStrategy: (times) => {
        // Reconnect with capped back-off; null = stop retrying
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis error — queue features degraded: ${err.message}`);
    });
  }

  /** Generate human-readable session ID: ORD-4821 */
  generateSessionId(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${num}`;
  }

  /** Get current queue length for a restaurant */
  async getQueueLength(restaurantId: string): Promise<number> {
    try {
      const key = `queue:${restaurantId}:length`;
      const len = await this.redis.get(key);
      return parseInt(len || '0');
    } catch {
      return 0;
    }
  }

  /** Get next queue position (atomic INCR — no race conditions) */
  async getNextQueuePosition(restaurantId: string): Promise<number> {
    try {
      const key = `queue:${restaurantId}:counter`;
      const pos = await this.redis.incr(key);
      await this.redis.expire(key, 86400); // reset each day
      return pos;
    } catch {
      return Date.now(); // fallback: timestamp as position
    }
  }

  /** Add order to BullMQ queue */
  async enqueueOrder(order: QueuedOrder): Promise<void> {
    try {
      await this.ordersQueue.add('process-order', order, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      const lenKey = `queue:${order.restaurantId}:length`;
      await this.redis.incr(lenKey);
      await this.redis.expire(lenKey, 86400);

      this.logger.log(`Order ${order.sessionId} queued at position ${order.queuePosition}`);
    } catch (err) {
      this.logger.error('Failed to enqueue order — continuing without queue', err);
    }
  }

  /** Get queue position for a specific order */
  async getOrderQueuePosition(restaurantId: string, sessionId: string): Promise<number | null> {
    try {
      const jobs = await this.ordersQueue.getJobs(['waiting', 'active']);
      const myJob = jobs.find(
        (j) => j.data.restaurantId === restaurantId && j.data.sessionId === sessionId,
      );
      if (!myJob) return null;
      const waitingJobs = await this.ordersQueue.getJobs(['waiting']);
      const myIndex = waitingJobs.findIndex((j) => j.id === myJob.id);
      return myIndex === -1 ? 0 : myIndex + 1;
    } catch {
      return null;
    }
  }

  /** Get full queue for dashboard display */
  async getQueueForDashboard(restaurantId: string): Promise<QueuedOrder[]> {
    try {
      const jobs = await this.ordersQueue.getJobs(['waiting', 'active']);
      return jobs
        .filter((j) => j.data.restaurantId === restaurantId)
        .map((j) => j.data as QueuedOrder)
        .sort((a, b) => a.queuePosition - b.queuePosition);
    } catch {
      return [];
    }
  }

  /** Called when order is processed — decrements queue counter */
  async dequeueOrder(restaurantId: string): Promise<void> {
    try {
      const lenKey = `queue:${restaurantId}:length`;
      const current = await this.redis.get(lenKey);
      if (current && parseInt(current) > 0) {
        await this.redis.decr(lenKey);
      }
    } catch {
      // non-critical
    }
  }

  /** Cache pause state in Redis for fast reads */
  async setOrderingPauseCache(restaurantId: string, paused: boolean): Promise<void> {
    try {
      const key = `restaurant:${restaurantId}:ordering_paused`;
      await this.redis.set(key, paused ? 'true' : 'false', 'EX', 3600);
    } catch {
      // non-critical
    }
  }

  /** Reset daily counters (call at midnight) */
  async resetDailyCounter(restaurantId: string): Promise<void> {
    try {
      await this.redis.del(`queue:${restaurantId}:counter`);
      await this.redis.del(`queue:${restaurantId}:length`);
    } catch {
      // non-critical
    }
  }

  /**
   * Fresh-start: drain all BullMQ jobs for this restaurant + reset Redis keys.
   * Called from the dashboard "Fresh Start" action.
   */
  async clearRestaurantQueue(restaurantId: string): Promise<void> {
    try {
      // Remove all waiting/delayed/active jobs belonging to this restaurant
      const jobTypes = ['waiting', 'active', 'delayed', 'paused'] as const;
      const jobs = await this.ordersQueue.getJobs(jobTypes as any);
      const mine = jobs.filter((j) => j.data?.restaurantId === restaurantId);
      await Promise.all(mine.map((j) => j.remove().catch(() => {})));

      // Reset Redis counters
      await this.redis.del(`queue:${restaurantId}:counter`);
      await this.redis.del(`queue:${restaurantId}:length`);
      this.logger.log(`Fresh start: cleared ${mine.length} queued jobs for restaurant ${restaurantId}`);
    } catch (err) {
      this.logger.warn(`clearRestaurantQueue failed (non-critical): ${err}`);
    }
  }

  /**
   * Schedule an auto-cancel job for a PENDING order.
   * Fires after `timeoutMinutes` if the order is still PENDING.
   * Job key stored in Redis so we can cancel it on confirmation.
   */
  async scheduleOrderTimeout(orderId: string, restaurantId: string, timeoutMinutes: number): Promise<void> {
    try {
      const delayMs = timeoutMinutes * 60 * 1000;
      const job = await this.ordersQueue.add(
        'order-timeout',
        { orderId, restaurantId, timeoutMinutes },
        { delay: delayMs, removeOnComplete: 50, removeOnFail: 20 },
      );
      // Store job ID in Redis so we can remove it on confirmation
      const key = `order-timeout-job:${orderId}`;
      await this.redis.set(key, String(job.id), 'EX', timeoutMinutes * 60 + 60);
      this.logger.log(`Order ${orderId} will auto-cancel in ${timeoutMinutes}min (job ${job.id})`);
    } catch (err) {
      this.logger.warn(`Could not schedule timeout for order ${orderId}`, err);
    }
  }

  /** Cancel a pending timeout job (fire-and-forget — never await this from an HTTP handler) */
  async cancelOrderTimeout(orderId: string): Promise<void> {
    // Hard 3s ceiling — if Redis/Bull is slow we bail out rather than hanging
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('cancelOrderTimeout timed out')), 3000),
    );

    const work = async () => {
      const key = `order-timeout-job:${orderId}`;
      const jobId = await this.redis.get(key);
      if (!jobId) return;
      const job = await this.ordersQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled timeout job ${jobId} for order ${orderId}`);
      }
      await this.redis.del(key);
    };

    try {
      await Promise.race([work(), timeout]);
    } catch (err: any) {
      // Non-critical — processor will no-op when it checks order status
      this.logger.warn(`cancelOrderTimeout for ${orderId}: ${err?.message}`);
    }
  }
}
