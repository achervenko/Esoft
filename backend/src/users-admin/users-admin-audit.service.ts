import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { getRoleLabel } from './users-admin.mapper';

type EmployeeAuditData = {
  firstName: string;
  id: number;
  isActive?: boolean | null;
  lastName: string;
  middleName: string | null;
  position: string;
};

type UserAuditData = {
  banned?: boolean | null;
  email: string;
  employee?: { fullName: string } | null;
  id: string;
  role?: string | null;
  username?: string | null;
};

@Injectable()
export class UsersAdminAuditService {
  constructor(private readonly auditLog: AuditLogService) {}

  logEmployeeCreated(
    employee: EmployeeAuditData,
    actorUserId?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.CREATE,
      entityId: employee.id,
      entityType: 'employee',
      fields: this.employeeFields(employee, null),
      module: AuditModule.USERS,
      tx,
      userId: actorUserId,
    });
  }

  logEmployeeUpdated(params: {
    actorUserId?: string | null;
    newEmployee: EmployeeAuditData;
    oldEmployee: EmployeeAuditData;
    tx?: Prisma.TransactionClient;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityId: params.newEmployee.id,
      entityType: 'employee',
      fields: this.employeeFields(params.newEmployee, params.oldEmployee),
      module: AuditModule.USERS,
      tx: params.tx,
      userId: params.actorUserId,
    });
  }

  logEmployeeStatusChanged(params: {
    actorUserId?: string | null;
    newEmployee: EmployeeAuditData;
    oldEmployee: EmployeeAuditData;
    tx?: Prisma.TransactionClient;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.STATUS_CHANGE,
      entityId: params.newEmployee.id,
      entityType: 'employee',
      fields: [
        {
          fieldName: 'Статус сотрудника',
          newValue: this.getEmployeeStatusLabel(params.newEmployee.isActive),
          oldValue: this.getEmployeeStatusLabel(params.oldEmployee.isActive),
        },
      ],
      module: AuditModule.USERS,
      tx: params.tx,
      userId: params.actorUserId,
    });
  }

  logUserCreated(
    user: UserAuditData,
    actorUserId?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.CREATE,
      entityType: this.userEntityType(user.id),
      fields: this.userFields(user, null),
      module: AuditModule.USERS,
      tx,
      userId: actorUserId,
    });
  }

  logUserUpdated(params: {
    actorUserId?: string | null;
    newUser: UserAuditData;
    oldUser: UserAuditData;
    tx?: Prisma.TransactionClient;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityType: this.userEntityType(params.newUser.id),
      fields: this.userFields(params.newUser, params.oldUser),
      module: AuditModule.USERS,
      tx: params.tx,
      userId: params.actorUserId,
    });
  }

  logUserPasswordChanged(
    user: UserAuditData,
    actorUserId?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityType: this.userEntityType(user.id),
      fields: [
        {
          fieldName: 'Пароль',
          newValue: 'изменён',
          oldValue: 'скрыто',
        },
      ],
      module: AuditModule.USERS,
      tx,
      userId: actorUserId,
    });
  }

  logUserStatusChanged(params: {
    actorUserId?: string | null;
    newUser: UserAuditData;
    oldUser: UserAuditData;
    tx?: Prisma.TransactionClient;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.STATUS_CHANGE,
      entityType: this.userEntityType(params.newUser.id),
      fields: [
        {
          fieldName: 'Статус учётной записи',
          newValue: this.getUserStatusLabel(params.newUser.banned),
          oldValue: this.getUserStatusLabel(params.oldUser.banned),
        },
      ],
      module: AuditModule.USERS,
      tx: params.tx,
      userId: params.actorUserId,
    });
  }

  logUserAutoDisabledForEmployee(params: {
    actorUserId?: string | null;
    oldBanned?: boolean | null;
    tx?: Prisma.TransactionClient;
    userId: string;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.STATUS_CHANGE,
      entityType: this.userEntityType(params.userId),
      fields: [
        {
          fieldName: 'Статус учётной записи',
          newValue:
            'отключена автоматически вследствие отключения связанного сотрудника',
          oldValue: this.getUserStatusLabel(params.oldBanned),
        },
      ],
      module: AuditModule.USERS,
      tx: params.tx,
      userId: params.actorUserId,
    });
  }

  logUserPhotoUploaded(params: {
    actorUserId?: string | null;
    hadPreviousPhoto: boolean;
    tx?: Prisma.TransactionClient;
    user: UserAuditData;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.USER_PHOTO_UPLOAD,
      entityType: this.userEntityType(params.user.id),
      fields: [
        {
          fieldName: 'Фото пользователя',
          newValue: 'загружено',
          oldValue: params.hadPreviousPhoto ? 'загружено' : 'не указано',
        },
      ],
      module: AuditModule.USERS,
      tx: params.tx,
      userId: params.actorUserId,
    });
  }

  logUserPhotoDeleted(
    user: UserAuditData,
    actorUserId?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.USER_PHOTO_DELETE,
      entityType: this.userEntityType(user.id),
      fields: [
        {
          fieldName: 'Фото пользователя',
          newValue: 'удалено',
          oldValue: 'загружено',
        },
      ],
      module: AuditModule.USERS,
      tx,
      userId: actorUserId,
    });
  }

  private employeeFields(
    newEmployee: EmployeeAuditData | null,
    oldEmployee: EmployeeAuditData | null,
  ) {
    return [
      this.field('Фамилия', newEmployee?.lastName, oldEmployee?.lastName),
      this.field('Имя', newEmployee?.firstName, oldEmployee?.firstName),
      this.field('Отчество', newEmployee?.middleName, oldEmployee?.middleName),
      this.field('Должность', newEmployee?.position, oldEmployee?.position),
    ].filter((field) => field.newValue !== field.oldValue);
  }

  private userFields(
    newUser: UserAuditData | null,
    oldUser: UserAuditData | null,
  ) {
    return [
      this.field('Email', newUser?.email, oldUser?.email),
      this.field('Логин', newUser?.username, oldUser?.username),
      this.field(
        'Роль',
        getRoleLabel(newUser?.role),
        getRoleLabel(oldUser?.role),
      ),
      this.field(
        'Сотрудник',
        newUser?.employee?.fullName,
        oldUser?.employee?.fullName,
      ),
    ].filter((field) => field.newValue !== field.oldValue);
  }

  private field(fieldName: string, newValue: unknown, oldValue: unknown) {
    return {
      fieldName,
      newValue,
      oldValue,
    };
  }

  private getUserStatusLabel(banned: boolean | null | undefined) {
    return banned ? 'отключена' : 'включена';
  }

  private getEmployeeStatusLabel(isActive: boolean | null | undefined) {
    return isActive ? 'включён' : 'отключён';
  }

  private userEntityType(userId: string) {
    return `user_account:${userId}`;
  }
}
