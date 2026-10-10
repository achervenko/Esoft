import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

// Accounting specialists work only in PPE and can read their own profile.
@Injectable()
export class ReservedRoleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      session?: { user?: { id: string; role?: string } };
    }>();
    const user = request.session?.user;
    if (user?.role === 'accounting_specialist') {
      if (
        request.method === 'GET' &&
        (request.path === '/api/setup/status' || request.path === '/api/search')
      )
        return next.handle();
      if (request.path.startsWith('/api/ppe/')) return next.handle();
      const ownProfile = `/api/users/${encodeURIComponent(user.id)}/profile`;
      const ownPhoto = `/api/users/${encodeURIComponent(user.id)}/photo/`;
      if (
        request.method !== 'GET' ||
        (request.path !== ownProfile && !request.path.startsWith(ownPhoto))
      )
        throw new ForbiddenException(
          'Недостаточно прав для доступа к этому разделу.',
        );
    }
    return next.handle();
  }
}
