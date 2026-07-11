import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertCanEditEquipment } from '../auth/role-permissions';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentService } from './equipment.service';

@Controller('api/equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  findAll() {
    return this.equipmentService.findAll();
  }

  @Get('create-options')
  getCreateOptions() {
    return this.equipmentService.getCreateOptions();
  }

  @Get(':visibleId')
  findOne(@Param('visibleId', ParseIntPipe) visibleId: number) {
    return this.equipmentService.findOneByVisibleId(visibleId);
  }

  @Get(':visibleId/history')
  findHistory(@Param('visibleId', ParseIntPipe) visibleId: number) {
    return this.equipmentService.findHistoryByVisibleId(visibleId);
  }

  @Post()
  create(
    @Body() dto: CreateEquipmentDto,
    @Session() session: UserSession<Auth>,
  ) {
    return this.equipmentService.create(dto, session.user.id);
  }

  @Put(':visibleId')
  update(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Body() dto: CreateEquipmentDto,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanEditEquipment(session.user.role);

    return this.equipmentService.update(visibleId, dto, session.user.id);
  }
}
