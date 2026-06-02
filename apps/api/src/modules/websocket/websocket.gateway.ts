import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, ConnectedSocket,
  MessageBody, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SOCKET_ROOMS, WEBSOCKET_EVENTS } from '@dineflow/config';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    const token = client.handshake.auth?.token;
    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        client.data.user = payload;
      } catch {
        // anonymous connection — ok for customer tracking
      }
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:restaurant')
  handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurant_id: string; role: string },
  ) {
    const rooms = {
      dashboard: SOCKET_ROOMS.restaurantDashboard(data.restaurant_id),
      kitchen: SOCKET_ROOMS.restaurantKitchen(data.restaurant_id),
      waiter: SOCKET_ROOMS.restaurantWaiters(data.restaurant_id),
      orders: SOCKET_ROOMS.restaurantOrders(data.restaurant_id),
    };
    const room = rooms[data.role as keyof typeof rooms] || rooms.orders;
    client.join(room);
    this.logger.log(`${data.role} joined room: ${room}`);
    return { joined: room };
  }

  @SubscribeMessage('join:customer')
  handleJoinCustomer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurant_id: string },
  ) {
    const room = `restaurant:${data.restaurant_id}:customers`;
    client.join(room);
    return { joined: room };
  }

  @SubscribeMessage('join:order')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { order_id: string },
  ) {
    const room = SOCKET_ROOMS.order(data.order_id);
    client.join(room);
    return { joined: room };
  }

  @SubscribeMessage('join:session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { session_id: string; is_host: boolean },
  ) {
    const room = SOCKET_ROOMS.session(data.session_id);
    client.join(room);
    if (data.is_host) client.join(SOCKET_ROOMS.sessionHost(data.session_id));
    return { joined: room };
  }

  emitNewOrder(restaurantId: string, order: any) {
    this.server
      .to(SOCKET_ROOMS.restaurantKitchen(restaurantId))
      .to(SOCKET_ROOMS.restaurantWaiters(restaurantId))
      .to(SOCKET_ROOMS.restaurantDashboard(restaurantId))
      .emit(WEBSOCKET_EVENTS.ORDER_NEW, order);
  }

  emitOrderStatus(restaurantId: string, orderId: string, status: string) {
    const payload = { order_id: orderId, status, updated_at: new Date().toISOString() };
    this.server
      .to(SOCKET_ROOMS.restaurantKitchen(restaurantId))
      .to(SOCKET_ROOMS.restaurantDashboard(restaurantId))
      .to(SOCKET_ROOMS.order(orderId))
      .emit(WEBSOCKET_EVENTS.ORDER_STATUS, payload);
  }

  emitTableStatus(restaurantId: string, tableId: string, status: string, occupiedSince?: Date | null) {
    this.server
      .to(SOCKET_ROOMS.restaurantDashboard(restaurantId))
      .emit(WEBSOCKET_EVENTS.TABLE_STATUS, {
        table_id: tableId,
        status,
        occupied_since: occupiedSince ? occupiedSince.toISOString() : null,
      });
  }

  emitSessionEvent(sessionId: string, event: string, data: any) {
    this.server.to(SOCKET_ROOMS.session(sessionId)).emit(event, data);
  }

  emitRestaurantStatus(restaurantId: string, paused: boolean, reason?: string) {
    const payload = { paused, reason: reason || null, updated_at: new Date().toISOString() };
    // Notify dashboard
    this.server
      .to(SOCKET_ROOMS.restaurantDashboard(restaurantId))
      .emit(WEBSOCKET_EVENTS.RESTAURANT_STATUS, payload);
    // Notify customers browsing the menu
    this.server
      .to(`restaurant:${restaurantId}:customers`)
      .emit(WEBSOCKET_EVENTS.RESTAURANT_STATUS, payload);
  }

  emitOrderModified(
    restaurantId: string,
    orderId: string,
    modifications: Array<{ item_id: string; item_name: string; cancelled?: boolean; new_quantity?: number; reason?: string }>,
    waiterNote?: string,
    updatedOrder?: any,
  ) {
    const payload = {
      order_id: orderId,
      modifications,
      waiter_note: waiterNote || null,
      order: updatedOrder || null,
      updated_at: new Date().toISOString(),
    };
    // Notify the customer tracking this order
    this.server.to(SOCKET_ROOMS.order(orderId)).emit(WEBSOCKET_EVENTS.ORDER_MODIFIED, payload);
    // Notify the restaurant dashboard so other staff see the updated card
    this.server.to(SOCKET_ROOMS.restaurantDashboard(restaurantId)).emit(WEBSOCKET_EVENTS.ORDER_MODIFIED, payload);
  }

  emitQueueUpdate(restaurantId: string, queue: any[]) {
    this.server
      .to(SOCKET_ROOMS.restaurantDashboard(restaurantId))
      .emit('queue:update', { queue, updated_at: new Date().toISOString() });
  }

  /** Emit decline/timeout reason directly to the customer tracking that order */
  emitOrderDeclined(orderId: string, reason: string) {
    this.server
      .to(SOCKET_ROOMS.order(orderId))
      .emit('order:declined', { order_id: orderId, reason, updated_at: new Date().toISOString() });
  }
}
