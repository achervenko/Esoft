// One obligation always carries the complete quantity of its norm item.
export type ScheduledObligation = {
  scheduledAt: Date;
  quantity: number;
};
export type IssueSchedule = {
  plannedDate: Date | null;
  availableFrom: Date | null;
  obligationStatus: 'NOT_AVAILABLE' | 'EARLY' | 'DUE' | 'OVERDUE' | 'FINISHED';
  overdue: number;
  available: ScheduledObligation | null;
  nextFuture: ScheduledObligation | null;
};
