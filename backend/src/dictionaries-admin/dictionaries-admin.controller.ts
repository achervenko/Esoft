import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { DICTIONARIES_PERMISSIONS } from './dictionaries.permissions';
import { RequirePermission } from '../auth/require-permission';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { DictionariesAdminService } from './dictionaries-admin.service';

@Controller('api/dictionaries/admin')
export class DictionariesAdminController {
  constructor(
    private readonly dictionariesAdminService: DictionariesAdminService,
  ) {}

  @Get('overview')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  getOverview() {
    return this.dictionariesAdminService.getOverview();
  }

  @Get('manufacturers')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  listManufacturers() {
    return this.dictionariesAdminService.listManufacturers();
  }

  @Post('manufacturers')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  createManufacturer(@Body() payload: Record<string, unknown>) {
    return this.dictionariesAdminService.createManufacturer(payload);
  }

  @Put('manufacturers/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  updateManufacturer(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.dictionariesAdminService.updateManufacturer(id, payload);
  }

  @Delete('manufacturers/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  deleteManufacturer(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.dictionariesAdminService.deleteManufacturer(id);
  }

  @Get('models')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  listEquipmentModels() {
    return this.dictionariesAdminService.listEquipmentModels();
  }

  @Post('models')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  createEquipmentModel(@Body() payload: Record<string, unknown>) {
    return this.dictionariesAdminService.createEquipmentModel(payload);
  }

  @Put('models/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  updateEquipmentModel(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.dictionariesAdminService.updateEquipmentModel(id, payload);
  }

  @Delete('models/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  deleteEquipmentModel(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.dictionariesAdminService.deleteEquipmentModel(id);
  }

  @Get('countries')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  listCountries() {
    return this.dictionariesAdminService.listCountries();
  }

  @Post('countries')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  createCountry(@Body() payload: Record<string, unknown>) {
    return this.dictionariesAdminService.createCountry(payload);
  }

  @Put('countries/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  updateCountry(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.dictionariesAdminService.updateCountry(id, payload);
  }

  @Delete('countries/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  deleteCountry(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.dictionariesAdminService.deleteCountry(id);
  }

  @Get('objects')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  listObjects() {
    return this.dictionariesAdminService.listObjects();
  }

  @Post('objects')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  createObject(@Body() payload: Record<string, unknown>) {
    return this.dictionariesAdminService.createObject(payload);
  }

  @Put('objects/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  updateObject(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.dictionariesAdminService.updateObject(id, payload);
  }

  @Delete('objects/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  deleteObject(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.dictionariesAdminService.deleteObject(id);
  }

  @Get('locations')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  listLocations() {
    return this.dictionariesAdminService.listLocations();
  }

  @Post('locations')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  createLocation(@Body() payload: Record<string, unknown>) {
    return this.dictionariesAdminService.createLocation(payload);
  }

  @Put('locations/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  updateLocation(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.dictionariesAdminService.updateLocation(id, payload);
  }

  @Delete('locations/:id')
  @RequirePermission(DICTIONARIES_PERMISSIONS.MANAGE)
  deleteLocation(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.dictionariesAdminService.deleteLocation(id);
  }
}
