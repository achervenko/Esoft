import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { PPE_PERMISSIONS } from './ppe.permissions';
import { RequirePermission } from '../auth/require-permission';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { PpeCatalogService } from './ppe-catalog.service';
import { PpeEmployeesService } from './ppe-employees.service';
import { PpeNormsService } from './ppe-norms.service';
import {
  parseEffectiveNormQuery,
  parseNormListQuery,
} from './ppe-norms.validation';

@Controller('api/ppe')
export class PpeController {
  constructor(
    private readonly catalog: PpeCatalogService,
    private readonly employees: PpeEmployeesService,
    private readonly norms: PpeNormsService,
  ) {}

  @Get('norms')
  @RequirePermission(PPE_PERMISSIONS.READ)
  listNorms(@Query() query: unknown) {
    return this.norms.list(parseNormListQuery(query));
  }

  @Get('norms/:normId')
  @RequirePermission(PPE_PERMISSIONS.READ)
  findNorm(@Param('normId', ParsePositiveIntPipe) id: number) {
    return this.norms.findOne(id);
  }

  @Get('positions/:positionId/norm')
  @RequirePermission(PPE_PERMISSIONS.READ)
  findEffectiveNorm(
    @Param('positionId', ParsePositiveIntPipe) id: number,
    @Query() query: unknown,
  ) {
    const { date, gender } = parseEffectiveNormQuery(query);
    return this.norms.findEffectiveNorm(id, date, gender);
  }

  @Post('norms')
  @RequirePermission(PPE_PERMISSIONS.NORMS_MANAGE)
  createNorm(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    return this.norms.create(payload, session.user.id);
  }

  @Post('norms/:normId/revision')
  @RequirePermission(PPE_PERMISSIONS.NORMS_MANAGE)
  createNormRevision(
    @Param('normId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.norms.createRevision(id, payload, session.user.id);
  }

  @Put('norms/:normId')
  @RequirePermission(PPE_PERMISSIONS.NORMS_MANAGE)
  updateFutureNorm(
    @Param('normId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.norms.updateFuture(id, payload, session.user.id);
  }

  @Patch('norms/:normId/end')
  @RequirePermission(PPE_PERMISSIONS.NORMS_MANAGE)
  endNorm(
    @Param('normId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.norms.end(id, payload, session.user.id);
  }

  @Delete('norms/:normId')
  @RequirePermission(PPE_PERMISSIONS.NORMS_MANAGE)
  deleteFutureNorm(
    @Param('normId', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.norms.deleteFuture(id, session.user.id);
  }

  @Get('employees')
  @RequirePermission(PPE_PERMISSIONS.READ)
  listEmployees() {
    return this.employees.list();
  }

  @Get('employees/:employeeId')
  @RequirePermission(PPE_PERMISSIONS.READ)
  findEmployee(@Param('employeeId', ParsePositiveIntPipe) id: number) {
    return this.employees.findOne(id);
  }

  @Patch('employees/:employeeId/sizes')
  @RequirePermission(PPE_PERMISSIONS.EMPLOYEE_SIZES_MANAGE)
  updateEmployeeSizes(
    @Param('employeeId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.employees.updateSizes(id, payload, session.user.id);
  }

  @Get('positions')
  @RequirePermission(PPE_PERMISSIONS.READ)
  listPositions() {
    return this.employees.listPositions();
  }

  @Get('items')
  @RequirePermission(PPE_PERMISSIONS.READ)
  listItems() {
    return this.catalog.listItems();
  }

  @Get('items/:itemId')
  @RequirePermission(PPE_PERMISSIONS.READ)
  findItem(@Param('itemId', ParsePositiveIntPipe) id: number) {
    return this.catalog.findItem(id);
  }

  @Post('items')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  createItem(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    return this.catalog.createItem(payload, session.user.id);
  }

  @Put('items/:itemId')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  updateItem(
    @Param('itemId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.updateItem(id, payload, session.user.id);
  }

  @Patch('items/:itemId/status')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  setItemStatus(
    @Param('itemId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.setItemStatus(id, payload, session.user.id);
  }

  @Get('items/:itemId/sizes')
  @RequirePermission(PPE_PERMISSIONS.READ)
  listSizes(@Param('itemId', ParsePositiveIntPipe) id: number) {
    return this.catalog.listSizes(id);
  }

  @Post('items/:itemId/sizes')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  createSize(
    @Param('itemId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.createSize(id, payload, session.user.id);
  }

  @Put('items/:itemId/sizes')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  replaceSizes(
    @Param('itemId', ParsePositiveIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.replaceSizes(id, payload, session.user.id);
  }

  @Put('items/:itemId/sizes/:sizeId')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  updateSize(
    @Param('itemId', ParsePositiveIntPipe) itemId: number,
    @Param('sizeId', ParsePositiveIntPipe) sizeId: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.updateSize(itemId, sizeId, payload, session.user.id);
  }

  @Patch('items/:itemId/sizes/:sizeId/status')
  @RequirePermission(PPE_PERMISSIONS.CATALOG_MANAGE)
  setSizeStatus(
    @Param('itemId', ParsePositiveIntPipe) itemId: number,
    @Param('sizeId', ParsePositiveIntPipe) sizeId: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.setSizeStatus(itemId, sizeId, payload, session.user.id);
  }
}
