export type IntegrationEventEnvelope = Readonly<{
  eventId: string;
  objectId: string;
  type: string;
  version: string;
}>;
export type IntegrationConnection = Readonly<{
  baseUrl: string;
  authorizationEncrypted: string;
}>;
export interface IntegrationHttpClient {
  getJson(path: string, signal?: AbortSignal): Promise<unknown>;
}
export interface IntegrationSystemAdapter {
  readonly systemType: string;
  validateSourceConfig(config: unknown): void;
  createHttpClient(connection: IntegrationConnection): IntegrationHttpClient;
  testConnection?(client: IntegrationHttpClient): Promise<void>;
}
export type IntegrationFlowContext = Readonly<{
  sourceCode: string;
  actorUserId: string;
  event: IntegrationEventEnvelope;
  configVersion: number;
  config: unknown;
  client: IntegrationHttpClient;
}>;
export interface IntegrationFlowHandler {
  readonly flowCode: string;
  readonly name: string;
  readonly owner: string;
  readonly systemTypes: readonly string[];
  readonly configVersions: readonly number[];
  readonly incomingActions: readonly string[];
  readonly actorPermissions?: readonly string[];
  validateConfig(version: number, config: unknown): void;
  validateEvent(event: IntegrationEventEnvelope): void;
  handle(
    context: IntegrationFlowContext,
  ): Promise<void | IntegrationSkipResult>;
}

export type IntegrationSkipResult = {
  outcome: 'SKIPPED';
  code: string;
  summary: Record<string, string>;
};
