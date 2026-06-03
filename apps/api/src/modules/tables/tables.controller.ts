import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import {
  CreateTableDto, BulkCreateTableDto,
  UpdateTableDto, UpdateTableStatusDto,
} from './dto/create-table.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('tables')
@Controller('tables')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  getAll(@CurrentUser() user: any) {
    return this.tablesService.getTables(user.restaurant_id);
  }

  @Get('sections')
  getSections(@CurrentUser() user: any) {
    return this.tablesService.getSections(user.restaurant_id);
  }

  // ⚠ Static PATCH must come before :id to avoid NestJS matching it as a param
  @Patch('rename-section')
  renameSection(
    @CurrentUser() user: any,
    @Body() body: { old_name: string; new_name: string },
  ) {
    return this.tablesService.renameSection(user.restaurant_id, body.old_name, body.new_name);
  }

  @Get(':id')
  getOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tablesService.getTable(id, user.restaurant_id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTableDto) {
    return this.tablesService.createTable(dto, user.restaurant_id);
  }

  @Post('bulk')
  bulkCreate(@CurrentUser() user: any, @Body() dto: BulkCreateTableDto) {
    return this.tablesService.bulkCreateTables(dto, user.restaurant_id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.updateTable(id, dto, user.restaurant_id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tablesService.updateStatus(id, dto, user.restaurant_id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tablesService.deleteTable(id, user.restaurant_id);
  }
}
