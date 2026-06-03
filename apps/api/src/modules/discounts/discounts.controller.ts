import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto, UpdateDiscountDto, ValidateCouponDto } from './dto/create-discount.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('discounts')
@Controller('discounts')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  getDiscounts(
    @CurrentUser() user: any,
    @Query('scope') scope?: string,
    @Query('applied_by') appliedBy?: string,
    @Query('active_only') activeOnly?: string,
  ) {
    return this.discountsService.getDiscounts(user.restaurant_id, {
      scope,
      applied_by: appliedBy,
      active_only: activeOnly === 'true',
    });
  }

  /** Quick presets for billing UI */
  @Get('presets')
  getPresets(@CurrentUser() user: any) {
    return this.discountsService.getPresets(user.restaurant_id);
  }

  /** Generate a random coupon code (doesn't save — just returns a suggestion) */
  @Get('generate-code')
  generateCode() {
    return { code: this.discountsService.generateCode() };
  }

  /** Validate a coupon code at billing time */
  @Post('validate')
  validateCoupon(@CurrentUser() user: any, @Body() dto: ValidateCouponDto) {
    return this.discountsService.validateCoupon(dto, user.restaurant_id);
  }

  @Post()
  createDiscount(@CurrentUser() user: any, @Body() dto: CreateDiscountDto) {
    return this.discountsService.createDiscount(dto, user.restaurant_id);
  }

  @Patch(':id')
  updateDiscount(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountsService.updateDiscount(id, dto, user.restaurant_id);
  }

  @Delete(':id')
  deleteDiscount(@CurrentUser() user: any, @Param('id') id: string) {
    return this.discountsService.deleteDiscount(id, user.restaurant_id);
  }
}
