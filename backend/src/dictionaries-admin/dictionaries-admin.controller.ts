import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertAdmin } from '../auth/role-permissions';
import { DictionariesAdminService } from './dictionaries-admin.service';

@Controller('api/dictionaries/admin')
export class DictionariesAdminController {
  constructor(
    private readonly dictionariesAdminService: DictionariesAdminService,
  ) {}

  @Get('overview')
  getOverview(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.getOverview();
  }

  @Get('manufacturers')
  listManufacturers(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.listManufacturers();
  }

  @Post('manufacturers')
  createManufacturer(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.createManufacturer(payload);
  }

  @Put('manufacturers/:id')
  updateManufacturer(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.updateManufacturer(id, payload);
  }

  @Delete('manufacturers/:id')
  deleteManufacturer(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.deleteManufacturer(id);
  }

  @Get('countries')
  listCountries(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.listCountries();
  }

  @Post('countries')
  createCountry(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.createCountry(payload);
  }

  @Put('countries/:id')
  updateCountry(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.updateCountry(id, payload);
  }

  @Delete('countries/:id')
  deleteCountry(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.deleteCountry(id);
  }

  @Get('objects')
  listObjects(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.listObjects();
  }

  @Post('objects')
  createObject(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.createObject(payload);
  }

  @Put('objects/:id')
  updateObject(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.updateObject(id, payload);
  }

  @Delete('objects/:id')
  deleteObject(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.deleteObject(id);
  }

  @Get('locations')
  listLocations(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.listLocations();
  }

  @Post('locations')
  createLocation(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.createLocation(payload);
  }

  @Put('locations/:id')
  updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.updateLocation(id, payload);
  }

  @Delete('locations/:id')
  deleteLocation(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.dictionariesAdminService.deleteLocation(id);
  }
}
