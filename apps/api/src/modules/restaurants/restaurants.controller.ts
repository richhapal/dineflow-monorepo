import {
  Controller, Get, Patch, Post, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpsertBusinessHoursDto } from './dto/business-hours.dto';
import { AddHolidayDto } from './dto/add-holiday.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getMe(@CurrentUser() user: any) {
    return this.restaurantsService.findById(user.restaurant_id);
  }

  @Patch('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  update(@CurrentUser() user: any, @Body() dto: UpdateRestaurantDto) {
    return this.restaurantsService.update(user.restaurant_id, dto, user.restaurant_id);
  }

  @Get(':slug/public')
  getPublicConfig(@Param('slug') slug: string) {
    return this.restaurantsService.getPublicConfig(slug);
  }

  @Get(':slug/availability')
  checkAvailability(@Param('slug') slug: string) {
    return this.restaurantsService.checkAvailability(slug);
  }

  @Patch('me/theme')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  updateTheme(@CurrentUser() user: any, @Body() dto: UpdateThemeDto) {
    return this.restaurantsService.updateTheme(user.restaurant_id, dto, user.restaurant_id);
  }

  @Post('me/hours')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  upsertHours(@CurrentUser() user: any, @Body() dto: UpsertBusinessHoursDto) {
    return this.restaurantsService.upsertBusinessHours(user.restaurant_id, dto, user.restaurant_id);
  }

  @Post('me/holidays')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  addHoliday(@CurrentUser() user: any, @Body() dto: AddHolidayDto) {
    return this.restaurantsService.addHoliday(user.restaurant_id, dto, user.restaurant_id);
  }

  @Delete('me/holidays/:holidayId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  removeHoliday(@CurrentUser() user: any, @Param('holidayId') holidayId: string) {
    return this.restaurantsService.removeHoliday(user.restaurant_id, holidayId, user.restaurant_id);
  }

  @Post('me/toggle-open')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  toggleOpen(@CurrentUser() user: any) {
    return this.restaurantsService.toggleOpen(user.restaurant_id, user.restaurant_id);
  }

  @Post('me/toggle-pause')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  togglePause(@CurrentUser() user: any) {
    return this.restaurantsService.toggleOrderingPaused(user.restaurant_id, user.restaurant_id);
  }
}
