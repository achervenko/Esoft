import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACTIVE_MODULES } from '../config/active-modules.module';
import { getEffectiveUserRoles } from './role-module-policy';
import { hasPermission, isPermission } from './permission-policy';
import {
  ADDITIONAL_REQUIRED_PERMISSIONS,
  REQUIRED_PERMISSION,
} from './require-permission';
import { assertCanViewUserProfile } from './role-permissions';

export const AUTHENTICATE_REQUEST = Symbol('AUTHENTICATE_REQUEST');

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHENTICATE_REQUEST)
    private readonly authenticate: (
      context: ExecutionContext,
    ) => Promise<boolean>,
    @Inject(ACTIVE_MODULES) private readonly activeModules: readonly string[],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.authenticate(context))) return false;
    // Method metadata only: a new handler must make its own access decision.
    const handler = context.getHandler();
    const permission = this.reflector.get<unknown>(
      REQUIRED_PERMISSION,
      handler,
    );
    const additional = this.reflector.get<unknown>(
      ADDITIONAL_REQUIRED_PERMISSIONS,
      handler,
    );
    const validAdditional =
      additional === undefined ||
      (Array.isArray(additional) && additional.every(isPermission));
    const isPublic = this.reflector.get<unknown>('PUBLIC', handler) === true;
    if (isPublic && permission === undefined && additional === undefined)
      return true;
    if (isPublic || !isPermission(permission) || !validAdditional)
      throw new ForbiddenException({
        code: 'PERMISSION_NOT_DECLARED',
        message: 'Для операции не объявлено допустимое разрешение.',
      });
    const request = context.switchToHttp().getRequest<{
      params?: { id?: string };
      session?: { user?: { id: string; role?: unknown } };
      user?: { id: string; role?: unknown };
    }>();
    const user = request.session?.user;
    const effectiveRole = getEffectiveUserRoles(
      user?.role,
      this.activeModules,
    ).join(',');
    if (user) {
      const effectiveUser = { ...user, role: effectiveRole };
      request.session = { ...request.session, user: effectiveUser };
      request.user = effectiveUser;
    }
    if (
      !user ||
      !hasPermission(effectiveRole, permission) ||
      (Array.isArray(additional) &&
        !additional.every(
          (required: unknown) =>
            isPermission(required) && hasPermission(effectiveRole, required),
        ))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для этой операции.',
      });
    }
    if (permission === 'users.profile.read') {
      if (typeof request.params?.id !== 'string')
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Не указан пользователь для проверки доступа к профилю.',
        });
      assertCanViewUserProfile({
        currentUserId: user.id,
        requestedUserId: request.params.id,
        role: effectiveRole,
      });
    }
    return true;
  }
}
