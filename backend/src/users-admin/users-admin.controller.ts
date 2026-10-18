import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { USERS_PERMISSIONS } from '../users/users.permissions';
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import type { UploadedFileInput } from '../storage/storage.types';
import { PositionsAdminService } from './positions-admin.service';
import { EmployeesAdminService } from './employees-admin.service';
import { UserAccountsAdminService } from './user-accounts-admin.service';
import { UserCredentialsAdminService } from './user-credentials-admin.service';
import { UserPhotosAdminService } from './user-photos-admin.service';
import { UserStatusAdminService } from './user-status-admin.service';

const MAX_USER_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

@Controller('api/users/admin')
export class UsersAdminController {
  constructor(
    private readonly positionsAdminService: PositionsAdminService,
    private readonly employeeAdminService: EmployeesAdminService,
    private readonly userAccountsAdminService: UserAccountsAdminService,
    private readonly userCredentialsAdminService: UserCredentialsAdminService,
    private readonly userPhotosAdminService: UserPhotosAdminService,
    private readonly userStatusAdminService: UserStatusAdminService,
  ) {}

  @Get('positions')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  listPositions() {
    return this.positionsAdminService.list();
  }

  @Post('positions')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  createPosition(
    @Body() payload: { name?: unknown },
    @Session() session: UserSession<Auth>,
  ) {
    return this.positionsAdminService.save(null, payload, session.user.id);
  }

  @Put('positions/:id')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  updatePosition(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() payload: { name?: unknown },
    @Session() session: UserSession<Auth>,
  ) {
    return this.positionsAdminService.save(id, payload, session.user.id);
  }

  @Patch('positions/:id/status')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  setPositionStatus(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body('isActive') isActive: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.positionsAdminService.setStatus(id, isActive, session.user.id);
  }

  @Get('roles')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  listRoles() {
    return this.userAccountsAdminService.getRoles();
  }

  @Get('employees')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  listEmployees(@Session() session: UserSession<Auth>) {
    return this.employeeAdminService.listEmployees(session.user.id);
  }

  @Post('employees')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  createEmployee(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    return this.employeeAdminService.createEmployee(payload, session.user.id);
  }

  @Put('employees/:employeeId')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  updateEmployee(
    @Param('employeeId', ParsePositiveIntPipe) employeeId: number,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    return this.employeeAdminService.updateEmployee(
      employeeId,
      payload,
      session.user.id,
    );
  }

  @Patch('employees/:employeeId/status')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  setEmployeeStatus(
    @Param('employeeId', ParsePositiveIntPipe) employeeId: number,
    @Body('isActive') isActive: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.employeeAdminService.setEmployeeStatus({
      actorUserId: session.user.id,
      employeeId,
      isActive,
    });
  }

  @Get('accounts')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  listUsers() {
    return this.userAccountsAdminService.listUsers();
  }

  @Post('accounts')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  createUser(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    return this.userAccountsAdminService.createUser(payload, session.user.id);
  }

  @Put('accounts/:userId')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  updateUser(
    @Param('userId') userId: string,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    return this.userAccountsAdminService.updateUser(
      userId,
      payload,
      session.user.id,
    );
  }

  @Patch('accounts/:userId/password')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  setUserPassword(
    @Param('userId') userId: string,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    return this.userCredentialsAdminService.setUserPassword(
      userId,
      payload,
      session.user.id,
    );
  }

  @Patch('accounts/:userId/status')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  setUserStatus(
    @Param('userId') userId: string,
    @Body('banned') banned: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.userStatusAdminService.setUserStatus({
      banned,
      currentUserId: session.user.id,
      userId,
    });
  }

  @Post('accounts/:userId/photo')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_USER_PHOTO_SIZE_BYTES,
      },
    }),
  )
  uploadUserPhoto(
    @Param('userId') userId: string,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.userPhotosAdminService.uploadPhoto({
      actorUserId: session.user.id,
      file,
      userId,
    });
  }

  @Delete('accounts/:userId/photo')
  @RequirePermission(USERS_PERMISSIONS.MANAGE)
  deleteUserPhoto(
    @Param('userId') userId: string,
    @Session() session: UserSession<Auth>,
  ) {
    return this.userPhotosAdminService.deletePhoto({
      actorUserId: session.user.id,
      userId,
    });
  }
}
