import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { CreateOrderDto, CreatePublicOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto, ApplyDiscountDto } from './dto/update-status.dto';
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

    return order;
  }

  async findAll(restaurantId: string, status?: string) {
    return this.prisma.order.findMany({
      where: {
        restaurant_id: restaurantId,
        deleted_at: null,
        ...(status ? { status: status as any } : { status: { notIn: ['COMPLETED', 'CANCELLED'] as any[] } }),
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

    // Emit status event
    this.gateway.emitOrderStatus(restaurantId, id, dto.status);

    return updated;
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
}
