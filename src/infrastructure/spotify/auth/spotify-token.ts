/**
 * Spotify Infrastructure - Token Model & Expiration Lifecycle
 * Keeps sensitive tokens strictly unlogged and unexposed in error outputs.
 */

import { z } from 'zod';

/**
 * Raw JSON response received from Spotify token endpoint (/api/token)
 */
export const SpotifyTokenResponseSchema = z.object({
  access_token: z.string().min(1, 'access_token must not be empty'),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().int().positive('expires_in must be a positive integer'),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type SpotifyTokenResponse = z.infer<typeof SpotifyTokenResponseSchema>;

/**
 * Typed domain-level Spotify token entity used by clients and token managers
 */
export interface SpotifyToken {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
  readonly refreshToken?: string;
  readonly scope?: string;
  readonly obtainedAt: number; // Unix timestamp in milliseconds
}

/**
 * Default safety margin before actual expiration (60 seconds)
 * to avoid requests in-flight expiring before hitting Spotify edge servers.
 */
export const DEFAULT_SAFETY_WINDOW_SECONDS = 60;

/**
 * Checks if a token is expired or within the designated safety window.
 *
 * @param token - The SpotifyToken to inspect
 * @param safetyWindowSeconds - Buffer in seconds before actual expiration (defaults to 60s)
 * @param nowMs - Optional current timestamp injection for deterministic unit testing
 */
export function isTokenExpired(
  token: SpotifyToken,
  safetyWindowSeconds: number = DEFAULT_SAFETY_WINDOW_SECONDS,
  nowMs: number = Date.now()
): boolean {
  const expiresAtMs = token.obtainedAt + token.expiresIn * 1000;
  const safetyMarginMs = Math.max(0, safetyWindowSeconds) * 1000;
  return nowMs >= expiresAtMs - safetyMarginMs;
}

/**
 * Safely transforms a parsed SpotifyTokenResponse into an immutable SpotifyToken.
 * Preserves an existing refresh token if Spotify did not return a new one during a refresh grant.
 */
export function createSpotifyToken(
  response: SpotifyTokenResponse,
  fallbackRefreshToken?: string,
  obtainedAt: number = Date.now()
): SpotifyToken {
  return {
    accessToken: response.access_token,
    tokenType: response.token_type,
    expiresIn: response.expires_in,
    refreshToken: response.refresh_token ?? fallbackRefreshToken,
    scope: response.scope,
    obtainedAt,
  };
}
