import { type SpotifyConfig, validateSpotifyConfig } from './spotify-config.js';
import { type SpotifyToken, SpotifyTokenResponseSchema, createSpotifyToken } from './spotify-token.js';
import { SpotifyAuthError } from '../client/spotify-errors.js';

export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

export const DEFAULT_SPOTIFY_SCOPES: readonly string[] = Object.freeze([
  'playlist-read-private',
  'playlist-read-collaborative',
]);

export interface AuthorizationUrlOptions {
  readonly state: string;
  readonly scopes?: readonly string[];
  readonly showDialog?: boolean;
}

export interface SpotifyOAuthOptions {
  readonly config: SpotifyConfig;
  readonly fetchFn?: typeof fetch;
}

export class SpotifyOAuthService {
  private readonly config: SpotifyConfig;
  private readonly fetch: typeof fetch;

  constructor(options: SpotifyOAuthOptions) {
    this.config = validateSpotifyConfig(options.config);
    this.fetch = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }
}
