import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from './dto/create-category.dto';
import { CreateItemDto, UpdateItemDto } from './dto/create-item.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('public/:slug')
  getPublicMenu(@Param('slug') slug: string, @Query('lang') lang?: string) {
    return this.menuService.getPublicMenu(slug, lang);
  }

  @Get('categories')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getCategories(@CurrentUser() user: any, @Query('lang') lang?: string) {
    return this.menuService.getCategories(user.restaurant_id, lang);
  }

  @Post('categories')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  createCategory(@CurrentUser() user: any, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(dto, user.restaurant_id);
  }

  @Patch('categories/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  updateCategory(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.menuService.updateCategory(id, dto, user.restaurant_id);
  }

  @Delete('categories/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  deleteCategory(@CurrentUser() user: any, @Param('id') id: string) {
    return this.menuService.deleteCategory(id, user.restaurant_id);
  }

  @Post('categories/reorder')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  reorderCategories(@CurrentUser() user: any, @Body() dto: ReorderCategoriesDto) {
    return this.menuService.reorderCategories(dto.ids, user.restaurant_id);
  }

  @Get('items')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getItems(@CurrentUser() user: any, @Query('categoryId') categoryId?: string, @Query('lang') lang?: string) {
    return this.menuService.getItems(user.restaurant_id, categoryId, lang);
  }

  @Post('items')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  createItem(@CurrentUser() user: any, @Body() dto: CreateItemDto) {
    return this.menuService.createItem(dto, user.restaurant_id);
  }

  @Get('items/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getItem(@CurrentUser() user: any, @Param('id') id: string) {
    return this.menuService.getItem(id, user.restaurant_id);
  }

  @Patch('items/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  updateItem(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.menuService.updateItem(id, dto, user.restaurant_id);
  }

  @Delete('items/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  deleteItem(@CurrentUser() user: any, @Param('id') id: string) {
    return this.menuService.deleteItem(id, user.restaurant_id);
  }

  @Patch('items/:id/toggle')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  toggleAvailability(@CurrentUser() user: any, @Param('id') id: string) {
    return this.menuService.toggleAvailability(id, user.restaurant_id);
  }

  @Get('items/:id/translations')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getTranslations(@CurrentUser() user: any, @Param('id') id: string) {
    return this.menuService.getTranslations(id, user.restaurant_id);
  }

  @Patch('items/:id/translations/:lang')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  updateTranslation(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('lang') lang: string,
    @Body() dto: UpdateTranslationDto,
  ) {
    return this.menuService.updateTranslation(id, lang, dto, user.restaurant_id);
  }
}
