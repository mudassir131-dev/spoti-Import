import type { SpotifyTokenProvider } from './spotify-token-manager.js';

export const SPOTIFY_API_BASE_URL = 'https://api.spotify.com';

export interface SpotifyRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly params?: Record<string, string | number | boolean | undefined>;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

export interface SpotifyHttpClientOptions {
  readonly tokenProvider: SpotifyTokenProvider;
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
}
