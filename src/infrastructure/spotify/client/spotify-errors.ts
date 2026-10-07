export class SpotifyConfigError extends Error {
  readonly code = 'SPOTIFY_CONFIG_ERROR' as const;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SpotifyConfigError';
    this.details = details;
  }
}
