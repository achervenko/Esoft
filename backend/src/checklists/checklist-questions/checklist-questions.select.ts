export const moduleSummarySelect = {
  id: true,
  isActive: true,
  name: true,
} as const;

export const checklistQuestionInclude = {
  module: { select: moduleSummarySelect },
} as const;
