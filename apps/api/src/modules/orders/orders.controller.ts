import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreatePublicOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto, ApplyDiscountDto } from './dto/update-status.dto';
import { CreateSingleQROrderDto } from './dto/create-single-qr-order.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('customer/:sessionToken')
  getBySession(@Param('sessionToken') token: string) {
    return this.ordersService.getBySessionToken(token);
  }

  // ─── Single QR ordering (public, no auth) ───────────────────────────────
  @Post('single-qr')
  createFromSingleQR(@Body() dto: CreateSingleQROrderDto) {
    return this.ordersService.createFromSingleQR(dto);
  }

  @Get('queue-position/:restaurantId/:sessionId')
  getQueuePosition(
    @Param('restaurantId') restaurantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.ordersService.getQueuePosition(restaurantId, sessionId);
  }

  // ─── Dashboard queue (staff) ─────────────────────────────────────────────
  @Get('queue')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getDashboardQueue(@CurrentUser() user: any) {
    return this.ordersService.getDashboardQueue(user.restaurant_id);
  }

  @Post('public')
  createPublic(@Body() dto: CreatePublicOrderDto) {
    return this.ordersService.createPublic(dto);
  }

  @Get('public/:id')
  getPublicOrder(@Param('id') id: string) {
    return this.ordersService.getPublicOrderStatus(id);
  }

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto, user.restaurant_id);
  }

  @Get()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAll(user.restaurant_id, status, from, to);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.restaurant_id);
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto, user.id, user.restaurant_id);
  }

  /** Dashboard "Fresh Start" — cancel all open orders + reset all tables to AVAILABLE */
  @Post('fresh-start')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  freshStart(@CurrentUser() user: any) {
    return this.ordersService.freshStart(user.restaurant_id);
  }

  /** Waiter modifies item quantities / marks items unavailable before confirming */
  @Patch(':id/modify')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  modifyOrder(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ModifyOrderDto) {
    return this.ordersService.modifyOrder(id, dto, user.restaurant_id);
  }

  @Post(':id/items')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  addItems(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { items: CreateOrderDto['items'] }) {
    return this.ordersService.addItems(id, body.items, user.restaurant_id);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  cancelItem(@CurrentUser() user: any, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.ordersService.cancelItem(id, itemId, user.restaurant_id);
  }

  @Post(':id/discount')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  applyDiscount(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ApplyDiscountDto) {
    return this.ordersService.applyDiscount(id, dto, user.id, user.restaurant_id);
  }

  @Post(':id/decline')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  declineOrder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.ordersService.declineOrder(id, body.reason || 'Declined by restaurant', user.id, user.restaurant_id);
  }
}
