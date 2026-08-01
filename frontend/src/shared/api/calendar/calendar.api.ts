import { request } from "../api-client";
import type {
  CalendarDto,
  CalendarRangeResponse,
  CalendarWorkdayDto,
  CalendarWorkdayUpdatePayload,
} from "./calendar.types";

type CalendarQuery = {
  from: string;
  to: string;
};

export function getCalendar(query: CalendarQuery) {
  const searchParams = new URLSearchParams({
    from: query.from,
    to: query.to,
  });

  return request<CalendarDto>(`/api/calendar?${searchParams.toString()}`);
}

export function getCalendarRange(query: {
  dateFrom: string;
  dateTo: string;
}) {
  const searchParams = new URLSearchParams({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  return request<CalendarRangeResponse>(
    `/api/calendar/range?${searchParams.toString()}`,
  );
}

export function updateCalendarWorkday(payload: CalendarWorkdayUpdatePayload) {
  return request<CalendarWorkdayDto>("/api/calendar/workday", {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}
