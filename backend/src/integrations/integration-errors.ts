export class IntegrationFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly publicMessage?: string,
  ) {
    super(code);
    this.name = 'IntegrationFailure';
  }
}
