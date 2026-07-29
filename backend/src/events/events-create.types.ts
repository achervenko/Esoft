import type { EventExtensionCode, EventSource, Prisma } from '@prisma/client';
import type { EventChecklistAssignment } from './event-checklists/event-checklists.types';

export type CreateEventCommand = {
  checklistAssignments: EventChecklistAssignment[];
  extensionCode: EventExtensionCode | null;
  note: string | null;
  originalPlannedDate: Date;
  plannedDate: Date;
  responsibleUserIds: string[];
  source: EventSource;
  title: string;
};

export type CreateEventActor =
  | {
      kind: 'user';
      userId: string;
    }
  | {
      employeeId: number;
      kind: 'system';
      userId: string;
    };

export type ResolvedCreateEventActor = {
  auditUserId: string | null;
  employeeId: number;
  userId: string;
};

export type EventCreateOptions = {
  createChecklists?: (params: {
    assignments: EventChecklistAssignment[];
    createdBy: string;
    eventId: number;
    tx: Prisma.TransactionClient;
  }) => Promise<void>;
  createExtension?: (params: {
    eventId: number;
    tx: Prisma.TransactionClient;
  }) => Promise<void>;
};
