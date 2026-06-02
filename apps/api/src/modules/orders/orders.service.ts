import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { CreateOrderDto, CreatePublicOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto, ApplyDiscountDto } from './dto/update-status.dto';
import { CreateSingleQROrderDto } from './dto/create-single-qr-order.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';
import { OrderQueueService } from './order-queue.service';
import { calculateGST } from '@dineflow/utils';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY:     ['SERVED'],
  SERVED:    ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WebsocketGateway,
    private readonly queueService: OrderQueueService,
  ) {}

  async create(dto: CreateOrderDto, restaurantId: string) {
    // 1. Idempotency check
    const existing = await this.prisma.order.findUnique({
      where: { idempotency_key: dto.idempotency_key },
      include: { items: { include: { addons: true } } },
    });
    if (existing) return existing;

    // 2. Verify restaurant is open
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // 3. Fetch + snapshot menu item prices from DB — NEVER trust client prices
    const itemIds = dto.items.map((i) => i.menu_item_id);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurant_id: restaurantId, deleted_at: null },
      include: { variants: true, addonGroups: { include: { addons: true } } },
    });

    if (menuItems.length !== [...new Set(itemIds)].length) {
      throw new NotFoundException('One or more menu items not found');
    }

    const itemMap = new Map(menuItems.map((m) => [m.id, m]));

    // 4. Calculate subtotal from DB prices
    let subtotal = 0;
    const orderItemsData = dto.items.map((item) => {
      const menuItem = itemMap.get(item.menu_item_id)!;
      let unitPrice = Number(menuItem.base_price);

      if (item.variant_id) {
        const variant = menuItem.variants.find((v) => v.id === item.variant_id);
        if (variant) unitPrice = Number(variant.price);
      }

      const addons = (item.addon_ids || []).flatMap((addonId) =>
        menuItem.addonGroups.flatMap((g) => g.addons.filter((a) => a.id === addonId)),
      );
      const addonTotal = addons.reduce((sum, a) => sum + Number(a.price), 0);
      const totalPrice = (unitPrice + addonTotal) * item.quantity;
      subtotal += totalPrice;

      return {
        menu_item_id: item.menu_item_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        item_name: menuItem.name,
        notes: item.notes,
        addons: addons.map((a) => ({ addon_id: a.id, addon_name: a.name, price: a.price })),
      };
    });

    // 5. GST calculation
    const gstRate = Number(restaurant.gst_rate);
    const { cgst, sgst } = calculateGST(subtotal, gstRate);
    const serviceChargeRate = Number(restaurant.service_charge_rate || 0);
    const serviceCharge = Math.round(subtotal * serviceChargeRate * 100) / 100;
    const totalAmount = subtotal + cgst + sgst + serviceCharge;

    // 6. Create order in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          restaurant_id: restaurantId,
          table_id: dto.table_id,
          room_id: dto.room_id,
          order_type: dto.order_type as any,
          customer_name: dto.customer_name,
          customer_phone: dto.customer_phone,
          customer_lang: (dto.customer_lang || 'en') as any,
          covers: dto.covers || 1,
          notes: dto.notes,
          idempotency_key: dto.idempotency_key,
          subtotal,
          cgst_amount: cgst,
          sgst_amount: sgst,
          service_charge: serviceCharge,
          total_amount: totalAmount,
          items: {
            create: orderItemsData.map((item) => ({
              menu_item_id: item.menu_item_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              item_name: item.item_name,
              notes: item.notes,
              addons: {
                create: item.addons.map((a) => ({
                  addon_id: a.addon_id,
                  addon_name: a.addon_name,
                  price: a.price,
                })),
              },
            })),
          },
          statusHistory: {
            create: { status: 'PENDING', changed_by: 'customer' },
          },
        },
        include: {
          items: {
            include: {
              addons: true,
              menuItem: { select: { name: true } },
            },
          },
          statusHistory: true,
        },
      });
      return newOrder;
    });

    // 7. Emit WebSocket event
    this.gateway.emitNewOrder(restaurantId, order);

    // 8. Schedule auto-cancel timeout — fire-and-forget (never block the order response)
    if (!restaurant.auto_accept_orders) {
      const timeoutMin = restaurant.order_timeout_minutes ?? 10;
      this.queueService.scheduleOrderTimeout(order.id, restaurantId, timeoutMin).catch(() => {/* non-critical */});
    }

    return order;
  }

  async findAll(restaurantId: string, status?: string, from?: string, to?: string) {
    // When a date range is supplied, show ALL statuses (historical view).
    // Without a range, default to active orders only (live kitchen view).
    const hasDateFilter = !!(from || to);

    let dateFilter: any = {};
    if (from || to) {
      dateFilter.created_at = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const statusFilter = status
      ? { status: status as any }
      : hasDateFilter
        ? {}  // show all statuses for date-filtered views
        : { status: { notIn: ['COMPLETED', 'CANCELLED'] as any[] } };

    return this.prisma.order.findMany({
      where: {
        restaurant_id: restaurantId,
        deleted_at: null,
        ...statusFilter,
        ...dateFilter,
      },
      include: { items: { include: { addons: true } }, table: true, room: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
      include: {
        items: { include: { addons: true, menuItem: true, variant: true } },
        statusHistory: { orderBy: { created_at: 'asc' } },
        table: true,
        room: true,
        appliedDiscounts: true,
        bill: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, changedBy: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurant_id: restaurantId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`,
      );
    }

    const timestampMap: Record<string, string> = {
      CONFIRMED: 'confirmed_at',
      PREPARING: 'prepared_at',
      SERVED: 'served_at',
      COMPLETED: 'completed_at',
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: dto.status as any,
          ...(timestampMap[dto.status] ? { [timestampMap[dto.status]]: new Date() } : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: { order_id: id, status: dto.status as any, changed_by: changedBy, notes: dto.notes },
      });
      return updatedOrder;
    });

    // Emit order status event (synchronous in-process — always fast)
    this.gateway.emitOrderStatus(restaurantId, id, dto.status);

    // Sync table status based on order lifecycle
    if (updated.table_id) {
      const tableStatuses = ['CONFIRMED', 'CANCELLED', 'SERVED', 'COMPLETED'];
      if (tableStatuses.includes(dto.status)) {
        this.syncTableStatus(
          updated.table_id,
          restaurantId,
          { confirming: dto.status === 'CONFIRMED' },
        ).catch(() => {/* non-critical — table status is derived state */});
      }
    }

    // Fire-and-forget: Redis cleanup must never block the HTTP response
    if (dto.status === 'CONFIRMED' || dto.status === 'CANCELLED') {
      this.queueService.cancelOrderTimeout(id).catch(() => {/* non-critical */});
    }

    return updated;
  }

  async declineOrder(id: string, reason: string, changedBy: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurant_id: restaurantId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException(`Cannot decline an order with status ${order.status}`);
    }

    const declined = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED', decline_reason: reason },
      });
      await tx.orderStatusHistory.create({
        data: {
          order_id: id,
          status: 'CANCELLED',
          changed_by: changedBy,
          notes: `Declined: ${reason}`,
        },
      });
      return updated;
    });

    // ─── Respond immediately after DB commit ──────────────────────────────
    this.gateway.emitOrderStatus(restaurantId, id, 'CANCELLED');
    this.gateway.emitOrderDeclined(id, reason);

    // Sync table status — declined order may free the table
    if (declined.table_id) {
      this.syncTableStatus(declined.table_id, restaurantId).catch(() => {});
    }

    // Redis + BullMQ cleanup — fire-and-forget
    this.queueService.cancelOrderTimeout(id).catch(() => {});
    this.queueService.dequeueOrder(restaurantId).catch(() => {});

    return declined;
  }

  async addItems(id: string, items: CreateOrderDto['items'], restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurant_id: restaurantId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Cannot add items to a completed or cancelled order');
    }

    const itemIds = items.map((i) => i.menu_item_id);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurant_id: restaurantId, deleted_at: null },
      include: { variants: true, addonGroups: { include: { addons: true } } },
    });
    const itemMap = new Map(menuItems.map((m) => [m.id, m]));

    let additionalTotal = 0;
    const newItems = items.map((item) => {
      const menuItem = itemMap.get(item.menu_item_id)!;
      let unitPrice = Number(menuItem.base_price);
      if (item.variant_id) {
        const variant = menuItem.variants.find((v) => v.id === item.variant_id);
        if (variant) unitPrice = Number(variant.price);
      }
      const addons = (item.addon_ids || []).flatMap((addonId) =>
        menuItem.addonGroups.flatMap((g) => g.addons.filter((a) => a.id === addonId)),
      );
      const addonTotal = addons.reduce((sum, a) => sum + Number(a.price), 0);
      const totalPrice = (unitPrice + addonTotal) * item.quantity;
      additionalTotal += totalPrice;
      return { menu_item_id: item.menu_item_id, variant_id: item.variant_id, quantity: item.quantity, unit_price: unitPrice, total_price: totalPrice, item_name: menuItem.name, notes: item.notes, addons };
    });

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      for (const item of newItems) {
        await tx.orderItem.create({
          data: {
            order_id: id,
            menu_item_id: item.menu_item_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            item_name: item.item_name,
            notes: item.notes,
            addons: { create: item.addons.map((a) => ({ addon_id: a.id, addon_name: a.name, price: a.price })) },
          },
        });
      }
      const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId } });
      const newSubtotal = Number(order.subtotal) + additionalTotal;
      const gstRate = Number(restaurant!.gst_rate);
      const { cgst, sgst } = calculateGST(newSubtotal, gstRate);
      const serviceChargeRate = Number(restaurant!.service_charge_rate || 0);
      const serviceCharge = Math.round(newSubtotal * serviceChargeRate * 100) / 100;
      return tx.order.update({
        where: { id },
        data: { subtotal: newSubtotal, cgst_amount: cgst, sgst_amount: sgst, service_charge: serviceCharge, total_amount: newSubtotal + cgst + sgst + serviceCharge },
        include: { items: { include: { addons: true } } },
      });
    });

    // Notify kitchen of additional items
    this.gateway.server
      .to(require('@dineflow/config').SOCKET_ROOMS.restaurantKitchen(restaurantId))
      .emit(require('@dineflow/config').WEBSOCKET_EVENTS.ORDER_ITEM_ADDED, { order_id: id, items: newItems });

    return updatedOrder;
  }

  async cancelItem(orderId: string, itemId: string, restaurantId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, order_id: orderId },
      include: { order: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.restaurant_id !== restaurantId) throw new NotFoundException('Order not found');
    if (item.order.status === 'PREPARING' || item.order.status === 'READY' || item.order.status === 'SERVED') {
      throw new BadRequestException('Cannot cancel item that is already being prepared');
    }
    return this.prisma.orderItem.update({ where: { id: itemId }, data: { is_cancelled: true } });
  }

  async applyDiscount(orderId: string, dto: ApplyDiscountDto, staffId: string, restaurantId: string) {
    const [order, discount] = await Promise.all([
      this.prisma.order.findFirst({ where: { id: orderId, restaurant_id: restaurantId } }),
      this.prisma.discount.findFirst({ where: { id: dto.discount_id, restaurant_id: restaurantId, is_active: true, deleted_at: null } }),
    ]);
    if (!order) throw new NotFoundException('Order not found');
    if (!discount) throw new NotFoundException('Discount not found or inactive');

    let amountSaved = 0;
    if (discount.type === 'PERCENTAGE') {
      amountSaved = Math.round(Number(order.subtotal) * Number(discount.value) / 100 * 100) / 100;
      if (discount.max_discount_cap) amountSaved = Math.min(amountSaved, Number(discount.max_discount_cap));
    } else if (discount.type === 'FIXED_AMOUNT') {
      amountSaved = Math.min(Number(discount.value), Number(order.subtotal));
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.appliedDiscount.create({
        data: {
          order_id: orderId,
          discount_id: dto.discount_id,
          restaurant_id: restaurantId,
          discount_name: discount.name,
          discount_type: discount.type,
          discount_value: discount.value,
          amount_saved: amountSaved,
          applied_by_id: staffId,
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: {
          discount_amount: { increment: amountSaved },
          total_amount: { decrement: amountSaved },
        },
      });
    });
  }

  async createPublic(dto: CreatePublicOrderDto) {
    const qr = await this.prisma.qRCode.findUnique({
      where: { slug: dto.qr_slug },
      include: { restaurant: true },
    });
    if (!qr || !qr.is_active) throw new NotFoundException('QR code not found');

    return this.create({
      table_id: qr.table_id ?? undefined,
      order_type: 'DINE_IN' as any,
      customer_name: dto.customer_name,
      customer_lang: dto.customer_lang || 'en',
      idempotency_key: dto.idempotency_key,
      items: dto.items,
    }, qr.restaurant_id);
  }

  async getPublicOrderStatus(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        total_amount: true,
        created_at: true,
        decline_reason: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unit_price: true,
            notes: true,
            item_name: true,
            menuItem: { select: { name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getBySessionToken(sessionToken: string) {
    const session = await this.prisma.customerSession.findUnique({
      where: { session_token: sessionToken },
      include: {
        orders: {
          include: { items: { include: { addons: true } }, statusHistory: { orderBy: { created_at: 'asc' } } },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async createFromSingleQR(dto: CreateSingleQROrderDto) {
    // 1. Resolve QR → restaurant
    const qr = await this.prisma.qRCode.findUnique({
      where: { slug: dto.qr_slug },
      include: { restaurant: true },
    });
    if (!qr || !qr.is_active) throw new NotFoundException('QR code not found or inactive');

    const restaurant = qr.restaurant;

    // 2. Check ordering paused
    if (restaurant.is_ordering_paused) {
      throw new BadRequestException({
        error: 'ORDERING_PAUSED',
        message: restaurant.ordering_pause_reason || 'Ordering is temporarily paused',
        pause_until: restaurant.ordering_pause_until,
      });
    }

    // 3. Generate session ID + queue position
    const sessionId = this.queueService.generateSessionId();
    const queuePosition = await this.queueService.getNextQueuePosition(restaurant.id);

    // 4. Build order via existing create() with additional fields
    const orderDto: CreateOrderDto = {
      table_id: undefined, // outside/takeaway — no table assigned
      order_type: 'TAKEAWAY' as any,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      customer_lang: dto.customer_lang || 'en',
      idempotency_key: dto.idempotency_key,
      items: dto.items,
    };

    // 5. Delegate to create() for price calculation, GST, DB write
    const order = await this.create(orderDto, restaurant.id);

    // 6. Patch in the queue fields
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        order_session_id: sessionId,
        queue_position: queuePosition,
        seat_identifier: dto.seat_identifier || null,
      },
    });

    // 7. Enqueue in BullMQ + Redis — fire-and-forget (never block the order response)
    this.queueService.enqueueOrder({
      orderId: order.id,
      restaurantId: restaurant.id,
      sessionId,
      customerName: dto.customer_name,
      seatIdentifier: dto.seat_identifier || '',
      itemCount: dto.items.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: Number(order.total_amount),
      queuePosition,
      placedAt: new Date().toISOString(),
    }).then(() => {
      // Notify dashboard of new queue state only after enqueue succeeds
      this.queueService.getQueueForDashboard(restaurant.id)
        .then(q => this.gateway.emitQueueUpdate(restaurant.id, q))
        .catch(() => {/* non-critical */});
    }).catch(() => {/* non-critical */});

    return {
      ...order,
      order_session_id: sessionId,
      queue_position: queuePosition,
      seat_identifier: dto.seat_identifier || null,
    };
  }

  /**
   * Fresh start — called from the dashboard "🧹 Fresh Start" button.
   *
   * 1. Cancels all non-terminal orders (PENDING → SERVED)
   * 2. Marks every active table as AVAILABLE and clears occupied_since
   * 3. Drains the Redis / BullMQ queue for this restaurant
   *
   * Returns a summary so the frontend can show what was reset.
   */
  async freshStart(restaurantId: string) {
    // SERVED is excluded — food already delivered, don't cancel it
    const NON_TERMINAL: any[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];

    // 1. Cancel all open orders
    const { count: cancelledOrders } = await this.prisma.order.updateMany({
      where: { restaurant_id: restaurantId, status: { in: NON_TERMINAL }, deleted_at: null },
      data: { status: 'CANCELLED', decline_reason: 'Fresh start — reset by restaurant owner' },
    });

    // 2. Reset all active tables to AVAILABLE
    const { count: resetTables } = await this.prisma.restaurantTable.updateMany({
      where: {
        restaurant_id: restaurantId,
        is_active: true,
        status: { notIn: ['AVAILABLE', 'MAINTENANCE'] as any[] },
      },
      data: { status: 'AVAILABLE', occupied_since: null },
    });

    // 3. Drain the queue + Redis keys — fire-and-forget, non-blocking
    this.queueService.clearRestaurantQueue(restaurantId).catch(() => {});

    // 4. Emit table status reset to dashboard WS clients
    this.gateway.emitTableStatus(restaurantId, '__all__', 'RESET');

    // 5. Emit order status change so the kanban board clears itself
    this.gateway.emitOrderStatus(restaurantId, '__all__', 'FRESH_START');

    return { cancelledOrders, resetTables };
  }

  /**
   * Waiter modifies a PENDING order before confirming.
   *
   * Allowed operations per item:
   *  - Change quantity (> 0) → recalculate item total
   *  - quantity = 0 → cancel that item
   *  - is_unavailable = true → cancel + set unavailable_reason
   *
   * After mutations: recalculate order subtotal/GST/total, persist waiter_note,
   * emit order:modified to both the customer order room and the restaurant dashboard.
   */
  async modifyOrder(id: string, dto: ModifyOrderDto, restaurantId: string) {
    // 1. Load order with items
    const order = await this.prisma.order.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
      include: { items: { include: { addons: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Only PENDING orders can be modified. This order is ${order.status}.`,
      );
    }

    // 2. Build a map of existing items for fast lookup
    const itemMap = new Map(order.items.map((i) => [i.id, i]));

    // 3. Apply each modification in a transaction
    const modificationLog: Array<{
      item_id: string;
      item_name: string;
      cancelled?: boolean;
      new_quantity?: number;
      reason?: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const mod of dto.modifications) {
        const item = itemMap.get(mod.item_id);
        if (!item) continue; // silently skip unknown item IDs

        const shouldCancel =
          mod.is_unavailable === true || (mod.quantity !== undefined && mod.quantity === 0);

        if (shouldCancel) {
          await tx.orderItem.update({
            where: { id: mod.item_id },
            data: {
              is_cancelled: true,
              unavailable_reason: mod.unavailable_reason || (mod.is_unavailable ? 'Item unavailable' : null),
            },
          });
          modificationLog.push({
            item_id: mod.item_id,
            item_name: item.item_name,
            cancelled: true,
            reason: mod.unavailable_reason || (mod.is_unavailable ? 'Item unavailable' : undefined),
          });
        } else if (mod.quantity !== undefined && mod.quantity > 0 && mod.quantity !== item.quantity) {
          const newTotalPrice = Number(item.unit_price) * mod.quantity;
          await tx.orderItem.update({
            where: { id: mod.item_id },
            data: { quantity: mod.quantity, total_price: newTotalPrice },
          });
          modificationLog.push({
            item_id: mod.item_id,
            item_name: item.item_name,
            new_quantity: mod.quantity,
          });
        }
      }

      // 4. Recalculate order totals from non-cancelled items
      // Refetch current items (some may have just been updated above)
      const currentItems = await tx.orderItem.findMany({ where: { order_id: id } });
      const activeItems = currentItems.filter((i) => !i.is_cancelled);

      const newSubtotal = activeItems.reduce((sum, i) => sum + Number(i.total_price), 0);

      const restaurant = await tx.restaurant.findUnique({
        where: { id: restaurantId },
        select: { gst_rate: true, service_charge_rate: true },
      });
      const gstRate = Number(restaurant?.gst_rate ?? 0);
      const { cgst, sgst } = calculateGST(newSubtotal, gstRate);
      const serviceChargeRate = Number(restaurant?.service_charge_rate ?? 0);
      const serviceCharge = Math.round(newSubtotal * serviceChargeRate * 100) / 100;
      const newTotal = newSubtotal + cgst + sgst + serviceCharge;

      await tx.order.update({
        where: { id },
        data: {
          subtotal: newSubtotal,
          cgst_amount: cgst,
          sgst_amount: sgst,
          service_charge: serviceCharge,
          total_amount: newTotal,
          waiter_note: dto.waiter_note || null,
        },
      });
    });

    // 5. Return fresh order for the WS payload
    const updatedOrder = await this.prisma.order.findFirst({
      where: { id },
      include: { items: { include: { addons: true } }, table: true, room: true },
    });

    // 6. Emit to customer + dashboard — fire-and-forget-safe (in-process)
    this.gateway.emitOrderModified(
      restaurantId,
      id,
      modificationLog,
      dto.waiter_note,
      updatedOrder,
    );

    return updatedOrder;
  }

  /**
   * Auto-sync table status after any order lifecycle event.
   *
   * Rules:
   *  - Active orders remain  → OCCUPIED (keep existing occupied_since; set it now if transitioning in)
   *  - No active orders left → CLEANING, clear occupied_since
   *  - takeaway/no table_id  → no-op
   *
   * "Active" = not CANCELLED and not COMPLETED.
   */
  private async syncTableStatus(
    tableId: string,
    restaurantId: string,
    options: { confirming?: boolean } = {},
  ): Promise<void> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurant_id: restaurantId },
      select: { status: true, occupied_since: true },
    });
    if (!table) return;

    const activeCount = await this.prisma.order.count({
      where: {
        table_id: tableId,
        restaurant_id: restaurantId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] as any[] },
        deleted_at: null,
      },
    });

    let newStatus: string;
    let occupiedSince: Date | null;

    if (activeCount > 0) {
      newStatus = 'OCCUPIED';
      // Preserve existing occupied_since; only set it when transitioning in
      occupiedSince = table.occupied_since ?? (options.confirming ? new Date() : new Date());
    } else {
      newStatus = 'CLEANING';
      occupiedSince = null;
    }

    const alreadyCorrect =
      table.status === newStatus &&
      (newStatus !== 'OCCUPIED' || table.occupied_since !== null);

    if (alreadyCorrect) return;

    await this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: {
        status: newStatus as any,
        occupied_since: occupiedSince,
      },
    });

    this.gateway.emitTableStatus(restaurantId, tableId, newStatus, occupiedSince);
  }

  async getQueuePosition(restaurantId: string, sessionId: string) {
    const position = await this.queueService.getOrderQueuePosition(restaurantId, sessionId);
    const total = await this.queueService.getQueueLength(restaurantId);
    return { session_id: sessionId, position, total_in_queue: total };
  }

  async getDashboardQueue(restaurantId: string) {
    return this.queueService.getQueueForDashboard(restaurantId);
  }
}
