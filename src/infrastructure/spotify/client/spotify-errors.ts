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
