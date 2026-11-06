import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedFileInput } from '../../storage/storage.types';
import { MAX_FILE_SIZE_BYTES } from '../../storage/storage-file.validation';
import { WarehouseReservationOperationsService } from './reservation-operations.service';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseReservationsApiService } from './reservations-api.service';
@Controller('api/warehouse/reservations')
export class WarehouseReservationsController {
  constructor(
    private readonly reservations: WarehouseReservationsApiService,
    private readonly operations: WarehouseReservationOperationsService,
  ) {}
  @Post('documents')
  @RequirePermission(WAREHOUSE_PERMISSIONS.RESERVATIONS_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  upload(
    @UploadedFile() file: UploadedFileInput | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.operations.upload(file, session.user.id);
  }
  @Post(':id/operations')
  @RequirePermission(WAREHOUSE_PERMISSIONS.RESERVATIONS_ADMIN)
  operate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.operations.execute(id, body, session.user.id);
  }
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
