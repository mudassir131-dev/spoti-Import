/**
 * Spotify Infrastructure - Error Hierarchy
 * Strictly protects credentials from appearing in error messages or stack traces.
 */

/**
 * Raised when Spotify configuration is missing, incomplete, or invalid.
 */
export class SpotifyConfigError extends Error {
  readonly code = 'SPOTIFY_CONFIG_ERROR' as const;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SpotifyConfigError';
    this.details = details;
  }
}

/**
 * Raised when OAuth authorization, code exchange, or token refresh operations fail.
 */
export class SpotifyAuthError extends Error {
  readonly code = 'SPOTIFY_AUTH_ERROR' as const;
  readonly status?: number;
  readonly errorDescription?: string;

  constructor(message: string, options: { status?: number; errorDescription?: string; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'SpotifyAuthError';
    this.status = options.status;
    this.errorDescription = options.errorDescription;
  }
}

/**
 * Raised when a Spotify Web API HTTP request fails.
 * Captures machine-readable status, retryability, and rate limit hints without exposing tokens.
 */
export class SpotifyApiError extends Error {
  readonly code = 'SPOTIFY_API_ERROR' as const;
  readonly status: number;
  readonly endpoint: string;
  readonly method: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly spotifyErrorCode?: string;

  constructor(options: {
    message: string;
    status: number;
    endpoint: string;
    method: string;
    retryable?: boolean;
    retryAfterSeconds?: number;
    spotifyErrorCode?: string;
    cause?: unknown;
  }) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'SpotifyApiError';
    this.status = options.status;
    this.endpoint = options.endpoint;
    this.method = options.method.toUpperCase();
    this.spotifyErrorCode = options.spotifyErrorCode;
    this.retryAfterSeconds = options.retryAfterSeconds;

    // By default 429 and 5xx are retryable; 401, 403, 404, etc. are not
    this.retryable = options.retryable ?? (options.status === 429 || (options.status >= 500 && options.status < 600));
  }
}

import { SourceError } from '../../../core/domain/errors.js';

/**
 * Raised when a Spotify playlist URL or identifier is invalid, malformed, or of an unsupported resource type.
 */
export class SpotifyPlaylistUrlError extends SourceError {
  constructor(message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(
      message,
      {
        sourceName: 'spotify',
        operation: 'parsePlaylistUrl',
        ...details,
      },
      cause
    );
    this.name = 'SpotifyPlaylistUrlError';
  }
}

/**
 * Raised when a Spotify playlist is not found, private, or inaccessible without authentication.
 */
export class SpotifyUnavailableError extends SourceError {
  readonly status: number;

  constructor(message: string, status = 404, details: Record<string, unknown> = {}, cause?: unknown) {
    super(
      message,
      {
        sourceName: 'spotify',
        operation: 'fetchPlaylist',
        status,
        ...details,
      },
      cause
    );
    this.name = 'SpotifyUnavailableError';
    this.status = status;
  }
}

/**
 * Raised when the Spotify response format is unexpected or fails schema validation.
 */
export class SpotifyMalformedResponseError extends SourceError {
  constructor(message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(
      message,
      {
        sourceName: 'spotify',
        operation: 'parseResponse',
        ...details,
      },
      cause
    );
    this.name = 'SpotifyMalformedResponseError';
  }
}

/**
 * Raised when network connectivity to Spotify fails or encounters a timeout.
 */
export class SpotifyNetworkError extends SourceError {
  constructor(message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(
      message,
      {
        sourceName: 'spotify',
        operation: 'networkRequest',
        ...details,
      },
      cause
    );
    this.name = 'SpotifyNetworkError';
  }
}

/**
 * Raised when rate limiting (HTTP 429) is encountered on Spotify public endpoints.
 */
export class SpotifyRateLimitError extends SourceError {
  readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number, details: Record<string, unknown> = {}, cause?: unknown) {
    super(
      message,
      {
        sourceName: 'spotify',
        operation: 'rateLimit',
        retryAfterSeconds,
        ...details,
      },
      cause
    );
    this.name = 'SpotifyRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

