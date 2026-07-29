export type StartEventData = {
  version: number;
};

export type CompleteEventData = {
  factDate?: Date;
  version: number;
};

export type CancelEventData = {
  version: number;
};

export type InternalEventLifecycleData = {
  version?: number;
};

export type EventLifecycleResult = {
  eventId: number;
};
