export type EquipmentProgressDailyCountDto = {
  count: number;
  date: string;
};

export type IncompleteEquipmentProgressDto = {
  missingFields: string[];
  name: string;
  visibleId: number;
};

export type EquipmentProgressDashboardDto = {
  averageCreatedPerDay: number;
  completedCardsCount: number;
  createdCount: number;
  estimatedCompletionDate: string | null;
  estimatedDaysRemaining: number | null;
  incompleteCardsCount: number;
  incompleteEquipment: IncompleteEquipmentProgressDto[];
  progressPercent: number;
  recentCreatedCount: number;
  recentDailyCounts: EquipmentProgressDailyCountDto[];
  remainingCount: number;
  targetCount: number;
};
