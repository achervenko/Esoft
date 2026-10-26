import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseReservationsApiService } from './reservations-api.service';
@Controller('api/warehouse/reservations')
export class WarehouseReservationsController {
  constructor(private readonly reservations: WarehouseReservationsApiService) {}
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.RESERVATIONS_MANAGE)
  list(@Query() query: unknown) {
    return this.reservations.list(query);
  }
  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.RESERVATIONS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.reservations.create(body, session.user.id);
  }
  @Patch(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.RESERVATIONS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.reservations.update(id, body, session.user.id);
  }
  @Delete(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.RESERVATIONS_MANAGE)
  release(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.reservations.release(id, session.user.id);
  }
}
