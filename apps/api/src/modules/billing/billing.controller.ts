import {
  Controller, Get, Post, Param, Body,
  Query, UseGuards, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateCustomBillDto } from './dto/create-custom-bill.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get(':id/public')
  getBillPublic(@Param('id') id: string) {
    return this.billingService.getBillPublic(id);
  }

  @Post('generate/:orderId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  generate(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() body?: { discount_id?: string; coupon_code?: string; discount_amount?: number },
  ) {
    return this.billingService.generateBill(orderId, user.restaurant_id, body);
  }

  @Get()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getBills(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.billingService.getBills(user.restaurant_id, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
    });
  }

  @Get('gst-summary')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  gstSummary(
    @CurrentUser() user: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.billingService.getGSTSummary(user.restaurant_id, parseInt(month), parseInt(year));
  }

  @Get('export-gstr1')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  async exportGSTR1(
    @CurrentUser() user: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const csv = await this.billingService.exportGSTR1(user.restaurant_id, parseInt(month), parseInt(year));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1-${month}-${year}.csv`);
    res.send(csv);
  }

  @Post('generate-combined')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  generateCombined(
    @CurrentUser() user: any,
    @Body() body: { order_ids: string[]; discount_id?: string; coupon_code?: string; discount_amount?: number },
  ) {
    return this.billingService.generateCombinedBill(body.order_ids, user.restaurant_id, {
      discount_id: body.discount_id,
      coupon_code: body.coupon_code,
      discount_amount: body.discount_amount,
    });
  }

  @Post('custom')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  createCustomBill(@CurrentUser() user: any, @Body() dto: CreateCustomBillDto) {
    return this.billingService.createCustomBill(dto, user.restaurant_id);
  }

  // ⚠ Static routes MUST come before :id to avoid NestJS matching them as a param
  @Post('checkout-table/:tableId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  checkoutTable(
    @CurrentUser() user: any,
    @Param('tableId') tableId: string,
    @Body() body: { payment_method: string },
  ) {
    return this.billingService.checkoutTable(tableId, user.restaurant_id, body.payment_method);
  }

  @Get('unbilled-orders')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getUnbilledOrders(@CurrentUser() user: any) {
    return this.billingService.getUnbilledOrders(user.restaurant_id);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getBill(@CurrentUser() user: any, @Param('id') id: string) {
    return this.billingService.getBill(id, user.restaurant_id);
  }

  @Post(':id/send-whatsapp')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  sendWhatsApp(@CurrentUser() user: any, @Param('id') id: string) {
    return this.billingService.sendBillWhatsApp(id, user.restaurant_id);
  }

  @Post(':id/payment')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  recordPayment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.billingService.recordPayment(id, dto, user.restaurant_id);
  }

  @Post(':id/apply-discount')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  applyDiscount(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { discount_id?: string; coupon_code?: string; discount_amount?: number; remove?: boolean },
  ) {
    return this.billingService.applyDiscountToBill(id, user.restaurant_id, body);
  }

  @Post(':id/cancel')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  cancelBill(@CurrentUser() user: any, @Param('id') id: string) {
    return this.billingService.cancelBill(id, user.restaurant_id);
  }
}
