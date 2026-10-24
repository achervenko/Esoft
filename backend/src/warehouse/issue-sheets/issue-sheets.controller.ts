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
import { WarehouseIssueSheetsService } from './issue-sheets.service';
import { WarehouseIssueSheetsQueryService } from './issue-sheets-query.service';
import { sheetRecord } from './issue-sheets.validation';

@Controller('api/warehouse/issue-sheets')
export class WarehouseIssueSheetsController {
  constructor(
    private readonly sheets: WarehouseIssueSheetsService,
    private readonly queries: WarehouseIssueSheetsQueryService,
  ) {}
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  list(@Query() query: unknown) {
    return this.queries.list(query);
  }
  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  findOne(@Param('id') id: string) {
    return this.queries.findOne(id);
  }
  @Get(':id/lines')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  lines(@Param('id') id: string, @Query() query: unknown) {
    return this.queries.lines(id, query);
  }
  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.sheets.create(body, session.user.id);
  }
  @Post(':id/lines')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  addLine(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.sheets.addLine(id, body, session.user.id);
  }
  @Patch(':id/lines/:lineId')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.sheets.updateLine(id, lineId, body, session.user.id);
  }
  @Delete(':id/lines/:lineId')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Session() session: UserSession<Auth>,
  ) {
    return this.sheets.removeLine(id, lineId, session.user.id);
  }
  @Post(':id/ready')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  ready(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    sheetRecord(body ?? {}, []);
    return this.sheets.markReady(id, session.user.id);
  }
  @Post(':id/finalize')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  finalize(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    sheetRecord(body ?? {}, []);
    return this.sheets.finalize(id, session.user.id);
  }
  @Post(':id/cancel')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ISSUE_SHEETS_MANAGE)
  cancel(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    sheetRecord(body ?? {}, []);
    return this.sheets.cancel(id, session.user.id);
  }
}
