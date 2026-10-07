export interface ImportErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly timestamp: string;
}

export abstract class ImportError extends Error implements ImportErrorPayload {
  abstract readonly code: string;
  readonly timestamp: string;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.details = details;
  }
}
