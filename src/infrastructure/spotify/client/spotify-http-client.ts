/**
 * Spotify Infrastructure - HTTP Client
 * Strictly authenticated client that executes Spotify Web API requests with error normalization.
 * Does not contain playlist business logic.
 */

import type { SpotifyTokenProvider } from './spotify-token-manager.js';
import { SpotifyApiError } from './spotify-errors.js';

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

export class SpotifyHttpClient {
  private readonly tokenProvider: SpotifyTokenProvider;
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  constructor(options: SpotifyHttpClientOptions) {
    this.tokenProvider = options.tokenProvider;
    this.baseUrl = (options.baseUrl ?? SPOTIFY_API_BASE_URL).replace(/\/+$/, '');
    this.fetch = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  async get<T>(endpoint: string, options: Omit<SpotifyRequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async request<T>(endpoint: string, options: SpotifyRequestOptions = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const token = await this.tokenProvider.getValidAccessToken(options.signal);

    const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...options.headers,
    };

    let requestBody: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetch(url.toString(), {
        method,
        headers,
        body: requestBody,
        signal: options.signal,
      });
    } catch (networkErr) {
      throw new SpotifyApiError({
        message: `Network error connecting to Spotify Web API: ${normalizedPath}`,
        status: 0,
        endpoint: normalizedPath,
        method,
        retryable: true,
        cause: networkErr,
      });
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, normalizedPath, method);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (parseErr) {
      throw new SpotifyApiError({
        message: `Malformed non-JSON response from Spotify API at ${normalizedPath}`,
        status: response.status,
        endpoint: normalizedPath,
        method,
        retryable: false,
        cause: parseErr,
      });
    }
  }

  private async handleErrorResponse(
    response: Response,
    endpoint: string,
    method: string
  ): Promise<never> {
    let spotifyErrorMessage: string | undefined;
    let spotifyErrorCode: string | undefined;

    try {
      const errBody: unknown = await response.json();
      if (typeof errBody === 'object' && errBody !== null) {
        const bodyRecord = errBody as Record<string, unknown>;
        if (typeof bodyRecord.error === 'object' && bodyRecord.error !== null) {
          const innerError = bodyRecord.error as Record<string, unknown>;
          if (typeof innerError.message === 'string') {
            spotifyErrorMessage = innerError.message;
          }
          if (innerError.status !== undefined) {
            spotifyErrorCode = String(innerError.status);
          }
        } else if (typeof bodyRecord.error_description === 'string') {
          spotifyErrorMessage = bodyRecord.error_description;
        } else if (typeof bodyRecord.message === 'string') {
          spotifyErrorMessage = bodyRecord.message;
        }
      }
    } catch {
      // Body was not JSON; proceed with status description
    }

    const retryAfterHeader = response.headers.get('Retry-After');
    let retryAfterSeconds: number | undefined;
    if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        retryAfterSeconds = parsed;
      }
    }

    const baseMessage = spotifyErrorMessage
      ? `Spotify API error (${response.status}): ${spotifyErrorMessage}`
      : `Spotify API request failed with status ${response.status}`;

    throw new SpotifyApiError({
      message: baseMessage,
      status: response.status,
      endpoint,
      method,
      retryAfterSeconds,
      spotifyErrorCode,
    });
  }
}
