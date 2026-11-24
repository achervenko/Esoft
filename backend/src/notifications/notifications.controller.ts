import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Sse,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { RequirePermission } from '../auth/require-permission';
import { NotificationsService } from './notifications.service';
import {
  distinctUntilChanged,
  exhaustMap,
  interval,
  map,
  merge,
  takeUntil,
  timer,
} from 'rxjs';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Sse('stream')
  @RequirePermission('notifications.read')
  stream(@Session() session: UserSession<Auth>) {
    const changes = timer(0, 2000).pipe(
      exhaustMap(() => this.notifications.feedRevision(session.user.id)),
      distinctUntilChanged(),
      map(() => ({ type: 'notifications-changed', data: {} })),
    );
    const heartbeat = interval(15000).pipe(
      map(() => ({ type: 'heartbeat', data: {} })),
    );
    // Reauthenticate periodically and stop at session expiry.
    const lifetime = Math.min(
      300000,
      Math.max(0, +new Date(session.session.expiresAt) - Date.now()),
    );
    return merge(changes, heartbeat).pipe(takeUntil(timer(lifetime)));
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermission('notifications.read')
  list(
    @Query() query: Record<string, unknown>,
    @Session() session: UserSession<Auth>,
  ) {
    return this.notifications.list(session.user.id, query);
  }

  @Get('unread-count')
  @Header('Cache-Control', 'no-store')
  @RequirePermission('notifications.read')
  unreadCount(@Session() session: UserSession<Auth>) {
    return this.notifications.unreadCount(session.user.id);
  }

  @Patch('read-all')
  @RequirePermission('notifications.read')
  markAllRead(@Session() session: UserSession<Auth>) {
    return this.notifications.markAllRead(session.user.id);
  }

  @Patch(':id/read')
  @RequirePermission('notifications.read')
  markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Session() session: UserSession<Auth>,
  ) {
    return this.notifications.markRead(session.user.id, id);
  }
}
