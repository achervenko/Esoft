import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { ParseOptionalPositiveIntPipe } from '../application/pipes/parse-optional-positive-int.pipe';
import { EQUIPMENT_PERMISSIONS } from './equipment.permissions';
import { RequirePermission } from '../auth/require-permission';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentService } from './equipment.service';

@Controller('api/equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @RequirePermission(EQUIPMENT_PERMISSIONS.READ)
  findAll(@Query() query: import('./equipment-list-query').EquipmentListQuery) {
    return this.equipmentService.findAll(query);
  }

  @Get('create-options')
  @RequirePermission(EQUIPMENT_PERMISSIONS.READ)
  getCreateOptions(
    @Query('visibleId', ParseOptionalPositiveIntPipe)
    visibleId?: number,
  ) {
    return this.equipmentService.getCreateOptions(visibleId);
  }

  @Get(':visibleId')
  @RequirePermission(EQUIPMENT_PERMISSIONS.READ)
  findOne(@Param('visibleId', ParsePositiveIntPipe) visibleId: number) {
    return this.equipmentService.findOneByVisibleId(visibleId);
  }

  @Get(':visibleId/history')
  @RequirePermission(EQUIPMENT_PERMISSIONS.READ)
  findHistory(@Param('visibleId', ParsePositiveIntPipe) visibleId: number) {
    return this.equipmentService.findHistoryByVisibleId(visibleId);
  }

  @Post()
  @RequirePermission(EQUIPMENT_PERMISSIONS.EDIT)
  create(
    @Body() dto: CreateEquipmentDto,
    @Session() session: UserSession<Auth>,
  ) {
    return this.equipmentService.create(dto, session.user.id);
  }

  @Put(':visibleId')
  @RequirePermission(EQUIPMENT_PERMISSIONS.EDIT)
  update(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Body() dto: CreateEquipmentDto,
    @Session() session: UserSession<Auth>,
  ) {
    return this.equipmentService.update(visibleId, dto, session.user.id);
  }
}
