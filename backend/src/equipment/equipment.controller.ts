import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
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

  @Post()
  create(@Body() dto: CreateEquipmentDto) {
    return this.equipmentService.create(dto);
  }
}
