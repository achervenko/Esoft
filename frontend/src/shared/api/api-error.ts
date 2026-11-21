export class ApiRequestError extends Error {
  readonly code?: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Не удалось выполнить действие.",
) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
