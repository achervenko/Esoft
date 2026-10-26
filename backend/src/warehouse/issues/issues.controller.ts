import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseIssuesService } from './issues.service';
import { WarehouseIssuesQueryService } from './issues-query.service';

@Controller('api/warehouse/issues')
export class WarehouseIssuesController {
  constructor(
    private readonly issues: WarehouseIssuesService,
    private readonly queries: WarehouseIssuesQueryService,
  ) {}
  @Get('available-balances')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUES_MANAGE)
  available(@Query() query: unknown) {
    return this.queries.available(query);
  }
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUES_MANAGE)
  list(@Query() query: unknown) {
    return this.queries.list(query);
  }
  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUES_MANAGE)
  get(@Param('id') id: string) {
    return this.queries.get(id);
  }
  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUES_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.issues.createIssue(body, session.user.id);
  }
  @Post('override-preview')
  @RequirePermission(WAREHOUSE_PERMISSIONS.OVERRIDE_RESERVATION)
  preview(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.issues.previewOverride(body, session.user.id);
  }
}
