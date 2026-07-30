import { ForbiddenException, Injectable } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { canViewEvents } from '../../auth/role-permissions';
import type { CalendarProvider } from './calendar-engine.types';
import { EquipmentEventsProvider } from './equipment-events.provider';
import { ProductionCalendarProvider } from './production-calendar.provider';

@Injectable()
export class CalendarSourceResolver {
  constructor(
    private readonly equipmentEventsProvider: EquipmentEventsProvider,
    private readonly productionCalendarProvider: ProductionCalendarProvider,
  ) {}

  resolveProviders(session: UserSession<Auth>): CalendarProvider[] {
    const providers: CalendarProvider[] = [];

    if (canViewEvents(session.user.role)) {
      providers.push(this.productionCalendarProvider);
      providers.push(this.equipmentEventsProvider);
    }

    if (providers.length === 0) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для просмотра календаря.',
      });
    }

    return providers;
  }
}
