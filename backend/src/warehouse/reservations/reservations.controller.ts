import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseReservationQueryService } from './reservations-query.service';
import { WarehouseReservationsService } from './reservations.service';
import { WarehouseReservationMoveService } from './reservation-move.service';

const { RESERVATIONS_READ, RESERVATIONS_MANAGE, RESERVATIONS_COVERAGE_MANAGE } =
  WAREHOUSE_PERMISSIONS;

@Controller('api/warehouse/reservations')
export class WarehouseReservationsController {
  constructor(
    private readonly queries: WarehouseReservationQueryService,
    private readonly commands: WarehouseReservationsService,
    private readonly moves: WarehouseReservationMoveService,
  ) {}

  @Get()
  @RequirePermission(RESERVATIONS_READ)
  list(@Query() query: unknown, @Session() session: UserSession<Auth>) {
    return this.queries.list(query, session.user.id);
  }

  @Get('orders/:orderId')
  @RequirePermission(RESERVATIONS_MANAGE)
  order(@Param('orderId') id: string, @Session() session: UserSession<Auth>) {
    return this.queries.order(id, session.user.id);
  }

  @Get(':id')
  @RequirePermission(RESERVATIONS_READ)
  get(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.queries.get(id, session.user.id);
  }

  @Get(':id/history')
  @RequirePermission(RESERVATIONS_READ)
  history(
    @Param('id') id: string,
    @Query() query: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.queries.history(id, query, session.user.id);
  }

  @Post()
  @RequirePermission(RESERVATIONS_MANAGE)
  reserve(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.commands.reserve(body, session.user.id);
  }

  @Post(':id/move')
  @RequirePermission(
    RESERVATIONS_MANAGE,
    WAREHOUSE_PERMISSIONS.TRANSFERS_MANAGE,
  )
  move(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.moves.move(id, body, session.user.id);
  }

  @Post(':id/decrease')
  @RequirePermission(RESERVATIONS_MANAGE)
  decrease(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.commands.decrease(id, body, session.user.id);
  }

  @Post(':id/coverage/reduce')
  @RequirePermission(RESERVATIONS_COVERAGE_MANAGE)
  reduceCoverage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.commands.reduceCoverage(id, body, session.user.id);
  }

  @Post(':id/coverage/restore')
  @RequirePermission(RESERVATIONS_COVERAGE_MANAGE)
  restoreCoverage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.commands.restoreCoverage(id, body, session.user.id);
  }
}
