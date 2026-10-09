import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import {
  assertCanReadPpe,
  assertCanManagePpeCatalog,
  assertCanManageEmployeeSizes,
  assertCanManagePpeNorms,
} from '../auth/role-permissions';
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
  listNorms(@Query() query: unknown, @Session() session: UserSession<Auth>) {
    assertCanReadPpe(session.user.role);
    return this.norms.list(parseNormListQuery(query));
  }

  @Get('norms/:normId')
  findNorm(
    @Param('normId', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.norms.findOne(id);
  }

  @Get('positions/:positionId/norm')
  findEffectiveNorm(
    @Param('positionId', ParseIntPipe) id: number,
    @Query() query: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.norms.findEffectiveNorm(id, parseEffectiveNormQuery(query));
  }

  @Post('norms')
  createNorm(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    assertCanManagePpeNorms(session.user.role);
    return this.norms.create(payload, session.user.id);
  }

  @Post('norms/:normId/revision')
  createNormRevision(
    @Param('normId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeNorms(session.user.role);
    return this.norms.createRevision(id, payload, session.user.id);
  }

  @Put('norms/:normId')
  updateFutureNorm(
    @Param('normId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeNorms(session.user.role);
    return this.norms.updateFuture(id, payload, session.user.id);
  }

  @Patch('norms/:normId/end')
  endNorm(
    @Param('normId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeNorms(session.user.role);
    return this.norms.end(id, payload, session.user.id);
  }

  @Delete('norms/:normId')
  deleteFutureNorm(
    @Param('normId', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeNorms(session.user.role);
    return this.norms.deleteFuture(id, session.user.id);
  }

  @Get('employees')
  listEmployees(@Session() session: UserSession<Auth>) {
    assertCanReadPpe(session.user.role);
    return this.employees.list();
  }

  @Get('employees/:employeeId')
  findEmployee(
    @Param('employeeId', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.employees.findOne(id);
  }

  @Patch('employees/:employeeId/sizes')
  updateEmployeeSizes(
    @Param('employeeId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEmployeeSizes(session.user.role);
    return this.employees.updateSizes(id, payload, session.user.id);
  }

  @Get('positions')
  listPositions(@Session() session: UserSession<Auth>) {
    assertCanReadPpe(session.user.role);
    return this.employees.listPositions();
  }

  @Get('items')
  listItems(@Session() session: UserSession<Auth>) {
    assertCanReadPpe(session.user.role);
    return this.catalog.listItems();
  }

  @Get('items/:itemId')
  findItem(
    @Param('itemId', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.catalog.findItem(id);
  }

  @Post('items')
  createItem(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.createItem(payload, session.user.id);
  }

  @Put('items/:itemId')
  updateItem(
    @Param('itemId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.updateItem(id, payload, session.user.id);
  }

  @Patch('items/:itemId/status')
  setItemStatus(
    @Param('itemId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.setItemStatus(id, payload, session.user.id);
  }

  @Get('items/:itemId/sizes')
  listSizes(
    @Param('itemId', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.catalog.listSizes(id);
  }

  @Post('items/:itemId/sizes')
  createSize(
    @Param('itemId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.createSize(id, payload, session.user.id);
  }

  @Put('items/:itemId/sizes')
  replaceSizes(
    @Param('itemId', ParseIntPipe) id: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.replaceSizes(id, payload, session.user.id);
  }

  @Put('items/:itemId/sizes/:sizeId')
  updateSize(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('sizeId', ParseIntPipe) sizeId: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.updateSize(itemId, sizeId, payload, session.user.id);
  }

  @Patch('items/:itemId/sizes/:sizeId/status')
  setSizeStatus(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('sizeId', ParseIntPipe) sizeId: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManagePpeCatalog(session.user.role);
    return this.catalog.setSizeStatus(itemId, sizeId, payload, session.user.id);
  }
}
