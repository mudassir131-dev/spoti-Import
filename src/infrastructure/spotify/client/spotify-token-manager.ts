/**
 * Spotify Infrastructure - Token Manager & Provider
 * Transparently manages token lifecycle and refreshes only when expired or inside safety window.
 */

import { type SpotifyToken, isTokenExpired, DEFAULT_SAFETY_WINDOW_SECONDS } from '../auth/spotify-token.js';
import type { SpotifyOAuthService } from '../auth/spotify-oauth.js';
import { SpotifyAuthError } from './spotify-errors.js';

export interface SpotifyTokenProvider {
  /**
   * Returns a valid, unexpired Bearer access token.
   * Refreshes automatically if expired and refresh capabilities are configured.
   */
  getValidAccessToken(signal?: AbortSignal): Promise<string>;

  /**
   * Returns the current token model snapshot (e.g. for inspection or caching).
   */
  getToken(): SpotifyToken;
}

export interface SpotifyTokenManagerOptions {
  readonly initialToken: SpotifyToken;
  readonly oauthService?: SpotifyOAuthService;
  readonly safetyWindowSeconds?: number;
  readonly onTokenRefreshed?: (newToken: SpotifyToken) => void;
}

export class SpotifyTokenManager implements SpotifyTokenProvider {
  private currentToken: SpotifyToken;
  private readonly oauthService?: SpotifyOAuthService;
  private readonly safetyWindowSeconds: number;
  private readonly onTokenRefreshed?: (newToken: SpotifyToken) => void;
  private refreshPromise: Promise<string> | null = null;

  constructor(options: SpotifyTokenManagerOptions) {
    this.currentToken = options.initialToken;
    this.oauthService = options.oauthService;
    this.safetyWindowSeconds = options.safetyWindowSeconds ?? DEFAULT_SAFETY_WINDOW_SECONDS;
    this.onTokenRefreshed = options.onTokenRefreshed;
  }

  getToken(): SpotifyToken {
    return this.currentToken;
  }

  async getValidAccessToken(signal?: AbortSignal): Promise<string> {
    // Check if token is still valid outside the safety margin
    if (!isTokenExpired(this.currentToken, this.safetyWindowSeconds)) {
      return this.currentToken.accessToken;
    }

    // Token is expired or inside safety window; refresh is needed
    if (!this.currentToken.refreshToken) {
      throw new SpotifyAuthError(
        'Spotify access token is expired and no refresh token is available to renew it.'
      );
    }

    if (!this.oauthService) {
      throw new SpotifyAuthError(
        'Spotify access token is expired and no OAuth service is configured to refresh it.'
      );
    }

    // Coalesce concurrent refresh requests into a single in-flight promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshedToken = await this.oauthService!.refreshAccessToken(
          this.currentToken.refreshToken!,
          signal
        );
        this.currentToken = refreshedToken;
        this.onTokenRefreshed?.(refreshedToken);
        return refreshedToken.accessToken;
      } catch (err) {
        if (err instanceof SpotifyAuthError) {
          throw err;
        }
        throw new SpotifyAuthError('Failed to refresh expired Spotify access token.', { cause: err });
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

/**
 * Creates a simple static token provider for short-lived or testing scenarios.
 */
export function createStaticTokenProvider(accessToken: string): SpotifyTokenProvider {
  const token: SpotifyToken = {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    obtainedAt: Date.now(),
  };

  return {
    async getValidAccessToken() {
      return accessToken;
    },
    getToken() {
      return token;
    },
  };
}
