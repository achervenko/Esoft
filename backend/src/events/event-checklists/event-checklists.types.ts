export type EventChecklistAssignment = {
  assignedUserId: string;
  checklistTemplateId: number;
};

export type CurrentEventChecklistState = EventChecklistAssignment & {
  id: number;
  sortOrder: number;
};
