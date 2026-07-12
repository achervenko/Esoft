import { Prisma } from '@prisma/client';

export type SearchIndexTx = Prisma.TransactionClient;

export type SearchIndexEntry = {
  entityType: string;
  entityId: number;
  title: string;
  subtitle: string | null;
  searchText: string;
  isActive?: boolean;
};

export type SearchResultDto = {
  details: {
    location: string | null;
    manufacturer: string | null;
    model: string | null;
    responsible: string | null;
    serialNumber: string | null;
    status: string | null;
  };
  id: string;
  entityType: string;
  entityId: number;
  title: string;
  subtitle: string | null;
  score: number;
  targetUrl: string | null;
};

export type SearchRebuildResultDto = {
  entityType: string;
  processed: number;
  durationMs: number;
  completedAt: string;
};
