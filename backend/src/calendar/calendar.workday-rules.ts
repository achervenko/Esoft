export function isWorkingHoursValidForWorkday(
  isWorkingDay: boolean,
  workingHours: number,
): boolean {
  return isWorkingDay ? workingHours > 0 : workingHours === 0;
}
