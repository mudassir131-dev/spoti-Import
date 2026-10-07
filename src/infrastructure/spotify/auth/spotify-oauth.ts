/**
 * Spotify Infrastructure - OAuth Service
 * Implements Authorization Code flow with CSRF state protection and native fetch.
 */

import { type SpotifyConfig, validateSpotifyConfig } from './spotify-config.js';
import {
  type SpotifyToken,
  SpotifyTokenResponseSchema,
  createSpotifyToken,
} from './spotify-token.js';
import { SpotifyAuthError } from '../client/spotify-errors.js';

export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

/**
 * Minimal scopes required strictly for importing public and private user playlists.
 */
export const DEFAULT_SPOTIFY_SCOPES: readonly string[] = Object.freeze([
  'playlist-read-private',
  'playlist-read-collaborative',
]);

export interface AuthorizationUrlOptions {
  /**
   * Cryptographically secure CSRF state token generated and persisted by the caller.
   */
  readonly state: string;

  /**
   * Optional custom scope list (defaults to minimal playlist import scopes).
   */
  readonly scopes?: readonly string[];

  /**
   * Whether or not to force the user to approve the app again.
   */
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

  /**
   * Builds an authorization URL with proper URL encoding and CSRF state parameter.
   */
  createAuthorizationUrl(options: AuthorizationUrlOptions): string {
    if (!options || typeof options.state !== 'string' || options.state.trim().length === 0) {
      throw new SpotifyAuthError('A non-empty state parameter is mandatory for CSRF protection.');
    }

    const scopes = options.scopes ?? DEFAULT_SPOTIFY_SCOPES;
    const url = new URL(SPOTIFY_AUTH_ENDPOINT);

    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('state', options.state);
    url.searchParams.set('scope', scopes.join(' '));

    if (options.showDialog) {
      url.searchParams.set('show_dialog', 'true');
    }

    return url.toString();
  }

  /**
   * Verifies that the state parameter returned by the callback matches the expected state.
   */
  verifyState(expectedState: string, receivedState: string | null | undefined): void {
    if (!expectedState || !receivedState || expectedState !== receivedState) {
      throw new SpotifyAuthError('CSRF state verification failed: received state does not match expected state.');
    }
  }

  /**
   * Exchanges an authorization code for an initial access token and refresh token.
   */
  async exchangeCodeForToken(code: string, signal?: AbortSignal): Promise<SpotifyToken> {
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new SpotifyAuthError('Authorization code must be a non-empty string.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code.trim(),
      redirect_uri: this.config.redirectUri,
    });

    return this.requestToken(body, undefined, signal);
  }

  /**
   * Refreshes an expired access token using the provided refresh token.
   */
  async refreshAccessToken(refreshToken: string, signal?: AbortSignal): Promise<SpotifyToken> {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new SpotifyAuthError('Refresh token must be a non-empty string.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken.trim(),
    });

    return this.requestToken(body, refreshToken.trim(), signal);
  }

  private async requestToken(
    body: URLSearchParams,
    fallbackRefreshToken?: string,
    signal?: AbortSignal
  ): Promise<SpotifyToken> {
    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
      'utf8'
    ).toString('base64');

    let response: Response;
    try {
      response = await this.fetch(SPOTIFY_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: body.toString(),
        signal,
      });
    } catch (networkErr) {
      throw new SpotifyAuthError('Network communication error contacting Spotify token endpoint.', {
        cause: networkErr,
      });
    }

    let responseJson: unknown;
    try {
      responseJson = await response.json();
    } catch (parseErr) {
      throw new SpotifyAuthError('Malformed non-JSON response from Spotify token endpoint.', {
        status: response.status,
        cause: parseErr,
      });
    }

    if (!response.ok) {
      const errRecord = (typeof responseJson === 'object' && responseJson !== null)
        ? (responseJson as Record<string, unknown>)
        : {};
      const errorMsg = typeof errRecord.error_description === 'string'
        ? errRecord.error_description
        : typeof errRecord.error === 'string'
        ? errRecord.error
        : `Token request failed with HTTP ${response.status}`;

      throw new SpotifyAuthError(`Spotify authentication error: ${errorMsg}`, {
        status: response.status,
        errorDescription: typeof errRecord.error_description === 'string' ? errRecord.error_description : undefined,
      });
    }

    const parseResult = SpotifyTokenResponseSchema.safeParse(responseJson);
    if (!parseResult.success) {
      const issueSummary = parseResult.error.issues.map((i) => i.message).join('; ');
      throw new SpotifyAuthError(`Invalid token response payload from Spotify: ${issueSummary}`, {
        status: response.status,
      });
    }

    return createSpotifyToken(parseResult.data, fallbackRefreshToken);
  }
}
