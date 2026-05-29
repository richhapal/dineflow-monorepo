import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto, ApplyDiscountDto } from './dto/update-status.dto';
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

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto, user.restaurant_id);
  }

  @Get()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  findAll(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.ordersService.findAll(user.restaurant_id, status);
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
}
