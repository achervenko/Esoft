import type { Prisma } from '@prisma/client';
import type {
  CurrentEventChecklistState,
  EventChecklistAssignment,
} from './event-checklists/event-checklists.types';

export type UpdateCreatedEventData = {
  checklistAssignments?: EventChecklistAssignment[];
  note?: string | null;
  plannedDate?: Date;
  responsibleUserIds?: string[];
  title?: string;
  version: number;
};

export type CurrentCreatedEventState = {
  currentChecklists: CurrentEventChecklistState[];
  currentNote: string | null;
  currentPlannedDate: Date;
  currentResponsibleUserIds: string[];
  currentTitle: string;
  version: number;
};

export type UpdateCreatedEventResult = {
  eventId: number;
  updated: boolean;
};

export type EventUpdateExtensionOptions = {
  afterUpdate?: (params: {
    eventId: number;
    tx: Prisma.TransactionClient;
  }) => Promise<void>;
  hasExtensionChanges?: boolean;
  requiresChecklistAssignments?: boolean;
  updateExtension?: (params: {
    eventId: number;
    tx: Prisma.TransactionClient;
  }) => Promise<void>;
  validateChecklists?: (params: {
    assignments: EventChecklistAssignment[];
    tx: Prisma.TransactionClient;
  }) => Promise<void>;
};

export type EventUpdateExtensionOptionsResolver = (params: {
  currentState: CurrentCreatedEventState;
  eventId: number;
  tx: Prisma.TransactionClient;
}) => Promise<EventUpdateExtensionOptions>;
