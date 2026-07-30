import { Injectable } from '@nestjs/common';
import { throwCalendarConflict } from '../calendar.errors';
import type {
  CalendarDayDto,
  CalendarDto,
  CalendarLayerDto,
  CalendarLayerCode,
  CalendarProvider,
} from './calendar-engine.types';

@Injectable()
export class CalendarEngineService {
  async buildCalendar(params: {
    dateFrom: Date;
    dateTo: Date;
    providers: CalendarProvider[];
  }): Promise<CalendarDto> {
    const days: CalendarDayDto[] = [];
    const layers: CalendarLayerDto[] = [];
    const layerCodes = new Set<CalendarLayerCode>();
    const period = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      today: startOfUtcDay(new Date()),
    };

    for (const provider of params.providers) {
      const data = await provider.getCalendarData(period);

      days.push(...(data.days ?? []));

      for (const layer of data.layers ?? []) {
        if (layerCodes.has(layer.code)) {
          throwCalendarConflict(
            'CALENDAR_LAYER_DUPLICATE',
            'Календарный слой с таким кодом уже сформирован.',
          );
        }

        layerCodes.add(layer.code);
        layers.push(layer);
      }
    }

    return { days, layers };
  }
}

function startOfUtcDay(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}
