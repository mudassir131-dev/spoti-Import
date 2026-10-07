/**
 * Universal Music Import Engine - Domain Errors
 * Strongly typed error hierarchy containing structured, machine-readable information.
 */

export interface ImportErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly timestamp: string;
}

/**
 * Base abstract class for all domain errors produced by the import engine.
 */
export abstract class ImportError extends Error implements ImportErrorPayload {
  abstract readonly code: string;
  readonly timestamp: string;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.details = details;

    // Preserve proper stack trace across runtime environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): ImportErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Raised when an import request, input payload, or track entity fails schema or boundary validation.
 */
export class ValidationError extends ImportError {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(message, details, cause);
  }
}
