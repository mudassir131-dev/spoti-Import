export class SpotifyConfigError extends Error {
  readonly code = 'SPOTIFY_CONFIG_ERROR' as const;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SpotifyConfigError';
    this.details = details;
  }
}

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
    this.retryable = options.retryable ?? (options.status === 429 || (options.status >= 500 && options.status < 600));
  }
}
