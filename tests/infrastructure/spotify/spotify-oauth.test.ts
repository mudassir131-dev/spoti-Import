import { describe, it, expect, vi } from 'vitest';
import {
  SpotifyOAuthService,
  DEFAULT_SPOTIFY_SCOPES,
  isTokenExpired,
  createSpotifyToken,
  SpotifyAuthError,
  type SpotifyConfig,
} from '../../../src/index.js';

describe('Spotify OAuth Flow & Token Expiration', () => {
  const fakeConfig: SpotifyConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://example.com/oauth/callback',
  };

  it('5 & 7. generates authorization URL with state parameter and default scopes', () => {
    const oauthService = new SpotifyOAuthService({ config: fakeConfig });
    const authUrl = oauthService.createAuthorizationUrl({ state: 'secure-state-123' });

    expect(authUrl).toContain('https://accounts.spotify.com/authorize');
    const parsed = new URL(authUrl);

    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/oauth/callback');
    expect(parsed.searchParams.get('state')).toBe('secure-state-123');
    expect(parsed.searchParams.get('scope')).toBe(DEFAULT_SPOTIFY_SCOPES.join(' '));
  });

  it('6. correctly encodes special characters in parameters', () => {
    const customConfig: SpotifyConfig = {
      clientId: 'client with spaces & symbols!@#',
      clientSecret: 'secret-val',
      redirectUri: 'https://example.com/callback?foo=bar&baz=qux',
    };

    const oauthService = new SpotifyOAuthService({ config: customConfig });
    const authUrl = oauthService.createAuthorizationUrl({
      state: 'csrf/state+test==',
      scopes: ['playlist-read-private', 'user-library-read'],
      showDialog: true,
    });

    const parsed = new URL(authUrl);
    expect(parsed.searchParams.get('client_id')).toBe('client with spaces & symbols!@#');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback?foo=bar&baz=qux');
    expect(parsed.searchParams.get('state')).toBe('csrf/state+test==');
    expect(parsed.searchParams.get('scope')).toBe('playlist-read-private user-library-read');
    expect(parsed.searchParams.get('show_dialog')).toBe('true');
  });

  it('rejects authorization URL creation with empty or missing state', () => {
    const oauthService = new SpotifyOAuthService({ config: fakeConfig });
    expect(() => oauthService.createAuthorizationUrl({ state: '' })).toThrow(SpotifyAuthError);
  });

  it('verifies state matching for CSRF protection', () => {
    const oauthService = new SpotifyOAuthService({ config: fakeConfig });
    expect(() => oauthService.verifyState('expected-state', 'expected-state')).not.toThrow();
    expect(() => oauthService.verifyState('expected-state', 'different-state')).toThrow(SpotifyAuthError);
    expect(() => oauthService.verifyState('expected-state', null)).toThrow(SpotifyAuthError);
  });

  it('8 & 9. exchanges authorization code for token and parses response', async () => {
    const mockFetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
      expect(url).toBe('https://accounts.spotify.com/api/token');
      expect(init?.method).toBe('POST');

      // Verify Basic auth header is present
      const headers = init?.headers as Record<string, string>;
      expect(headers['Authorization']).toMatch(/^Basic\s+/);

      return new Response(
        JSON.stringify({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'test-refresh-token',
          scope: 'playlist-read-private',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const oauthService = new SpotifyOAuthService({
      config: fakeConfig,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const token = await oauthService.exchangeCodeForToken('auth-code-xyz');
    expect(token.accessToken).toBe('test-access-token');
    expect(token.tokenType).toBe('Bearer');
    expect(token.expiresIn).toBe(3600);
    expect(token.refreshToken).toBe('test-refresh-token');
    expect(token.scope).toBe('playlist-read-private');
    expect(token.obtainedAt).toBeGreaterThan(0);
  });

  it('10. executes refresh token flow and preserves original refresh token if omitted in response', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: 'new-refreshed-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          // Spotify may omit refresh_token on refresh
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const oauthService = new SpotifyOAuthService({
      config: fakeConfig,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const token = await oauthService.refreshAccessToken('original-refresh-token');
    expect(token.accessToken).toBe('new-refreshed-access-token');
    expect(token.refreshToken).toBe('original-refresh-token');
  });

  it('11 & 12. detects token expiration and evaluates safety window', () => {
    const now = 1_000_000_000; // Simulated time in ms
    const token = createSpotifyToken(
      {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600, // 3600 seconds = 3,600,000 ms -> expires at now + 3,600,000
      },
      undefined,
      now
    );

    // 1. Just created, not expired
    expect(isTokenExpired(token, 60, now)).toBe(false);

    // 2. 1 hour minus 10 minutes (still valid, outside 60s safety window)
    const midPoint = now + 3_000_000;
    expect(isTokenExpired(token, 60, midPoint)).toBe(false);

    // 3. Exactly 45 seconds before expiration (inside 60s safety window)
    const insideSafetyWindow = now + (3600 * 1000) - (45 * 1000);
    expect(isTokenExpired(token, 60, insideSafetyWindow)).toBe(true);

    // 4. Past expiration timestamp
    const pastExpiration = now + (3601 * 1000);
    expect(isTokenExpired(token, 60, pastExpiration)).toBe(true);
  });

  it('21. ensures secrets never appear in thrown error messages during OAuth failure', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code or secret',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const oauthService = new SpotifyOAuthService({
      config: fakeConfig,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await oauthService.exchangeCodeForToken('bad-code');
      expect.unreachable('Should have thrown SpotifyAuthError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyAuthError);
      const authErr = err as SpotifyAuthError;
      expect(authErr.message).not.toContain(fakeConfig.clientSecret);
      expect(authErr.message).toContain('Invalid authorization code or secret');
    }
  });
});
