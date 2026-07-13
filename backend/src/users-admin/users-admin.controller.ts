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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertAdmin } from '../auth/role-permissions';
import type { UploadedFileInput } from '../storage/storage.types';
import { EmployeesAdminService } from './employees-admin.service';
import { UserAccountsAdminService } from './user-accounts-admin.service';
import { UserCredentialsAdminService } from './user-credentials-admin.service';
import { UserPhotosAdminService } from './user-photos-admin.service';
import { UserStatusAdminService } from './user-status-admin.service';

const MAX_USER_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

@Controller('api/users/admin')
export class UsersAdminController {
  constructor(
    private readonly employeeAdminService: EmployeesAdminService,
    private readonly userAccountsAdminService: UserAccountsAdminService,
    private readonly userCredentialsAdminService: UserCredentialsAdminService,
    private readonly userPhotosAdminService: UserPhotosAdminService,
    private readonly userStatusAdminService: UserStatusAdminService,
  ) {}

  @Get('roles')
  listRoles(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.userAccountsAdminService.getRoles();
  }

  @Get('employees')
  listEmployees(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.employeeAdminService.listEmployees();
  }

  @Post('employees')
  createEmployee(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.employeeAdminService.createEmployee(payload, session.user.id);
  }

  @Put('employees/:employeeId')
  updateEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.employeeAdminService.updateEmployee(
      employeeId,
      payload,
      session.user.id,
    );
  }

  @Delete('employees/:employeeId')
  deleteEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.employeeAdminService.deleteEmployee(employeeId, session.user.id);
  }

  @Get('accounts')
  listUsers(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.userAccountsAdminService.listUsers();
  }

  @Post('accounts')
  createUser(
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.userAccountsAdminService.createUser(payload, session.user.id);
  }

  @Put('accounts/:userId')
  updateUser(
    @Param('userId') userId: string,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.userAccountsAdminService.updateUser(
      userId,
      payload,
      session.user.id,
    );
  }

  @Patch('accounts/:userId/password')
  setUserPassword(
    @Param('userId') userId: string,
    @Body() payload: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.userCredentialsAdminService.setUserPassword(
      userId,
      payload,
      session.user.id,
    );
  }

  @Patch('accounts/:userId/status')
  setUserStatus(
    @Param('userId') userId: string,
    @Body('banned') banned: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.userStatusAdminService.setUserStatus({
      banned,
      currentUserId: session.user.id,
      userId,
    });
  }

  @Post('accounts/:userId/photo')
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
    assertAdmin(session.user.role);

    return this.userPhotosAdminService.uploadPhoto({
      actorUserId: session.user.id,
      file,
      userId,
    });
  }

  @Delete('accounts/:userId/photo')
  deleteUserPhoto(
    @Param('userId') userId: string,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.userPhotosAdminService.deletePhoto({
      actorUserId: session.user.id,
      userId,
    });
  }
}
