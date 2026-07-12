import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { getRoleLabel } from './users-admin.mapper';

type EmployeeAuditData = {
  firstName: string;
  id: number;
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

  logEmployeeCreated(employee: EmployeeAuditData, actorUserId?: string | null) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.CREATE,
      entityId: employee.id,
      entityType: 'employee',
      fields: this.employeeFields(employee, null),
      module: AuditModule.USERS,
      userId: actorUserId,
    });
  }

  logEmployeeUpdated(params: {
    actorUserId?: string | null;
    newEmployee: EmployeeAuditData;
    oldEmployee: EmployeeAuditData;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityId: params.newEmployee.id,
      entityType: 'employee',
      fields: this.employeeFields(params.newEmployee, params.oldEmployee),
      module: AuditModule.USERS,
      userId: params.actorUserId,
    });
  }

  logEmployeeDeleted(employee: EmployeeAuditData, actorUserId?: string | null) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.DELETE,
      entityId: employee.id,
      entityType: 'employee',
      fields: this.employeeFields(null, employee),
      module: AuditModule.USERS,
      userId: actorUserId,
    });
  }

  logUserCreated(user: UserAuditData, actorUserId?: string | null) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.CREATE,
      entityType: this.userEntityType(user.id),
      fields: this.userFields(user, null),
      module: AuditModule.USERS,
      userId: actorUserId,
    });
  }

  logUserUpdated(params: {
    actorUserId?: string | null;
    newUser: UserAuditData;
    oldUser: UserAuditData;
  }) {
    return this.auditLog.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityType: this.userEntityType(params.newUser.id),
      fields: this.userFields(params.newUser, params.oldUser),
      module: AuditModule.USERS,
      userId: params.actorUserId,
    });
  }

  logUserPasswordChanged(user: UserAuditData, actorUserId?: string | null) {
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
      userId: actorUserId,
    });
  }

  logUserStatusChanged(params: {
    actorUserId?: string | null;
    newUser: UserAuditData;
    oldUser: UserAuditData;
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
      userId: params.actorUserId,
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

  private userFields(newUser: UserAuditData | null, oldUser: UserAuditData | null) {
    return [
      this.field('Email', newUser?.email, oldUser?.email),
      this.field('Логин', newUser?.username, oldUser?.username),
      this.field('Роль', getRoleLabel(newUser?.role), getRoleLabel(oldUser?.role)),
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

  private userEntityType(userId: string) {
    return `user_account:${userId}`;
  }
}
