export const DATABASE_DATE_TIME_ZONE = "UTC";
export const BUSINESS_TIME_ZONE = "Europe/Moscow";

export function getBusinessDateString(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getBusinessTodayDateString() {
  return getBusinessDateString(new Date());
}

export function formatBusinessDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  },
) {
  return new Intl.DateTimeFormat("ru-RU", {
    ...options,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(typeof value === "string" ? new Date(value) : value);
}

// Local Date objects in calendar grids represent civil dates, not instants.
export function getCalendarDateId(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

// Date inputs represent local civil days; API DATE values should use YYYY-MM-DD.
export function formatCalendarDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date =
    value instanceof Date
      ? new Date(`${getCalendarDateId(value)}T00:00:00.000Z`)
      : new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00.000Z" : value,
        );
  return new Intl.DateTimeFormat("ru-RU", {
    ...options,
    timeZone: DATABASE_DATE_TIME_ZONE,
  }).format(date);
}
