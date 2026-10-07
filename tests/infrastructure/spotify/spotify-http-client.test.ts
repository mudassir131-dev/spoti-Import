import { describe, it, expect, vi } from 'vitest';
import {
  SpotifyHttpClient,
  SpotifyTokenManager,
  createStaticTokenProvider,
  SpotifyApiError,
  SpotifyAuthError,
  type SpotifyToken,
  type SpotifyOAuthService,
} from '../../../src/index.js';

describe('Spotify HTTP Client & Error Handling', () => {
  it('13. makes successful authenticated API request with Bearer token', async () => {
    const mockFetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
      expect(url).toBe('https://api.spotify.com/v1/me');
      expect(init?.method).toBe('GET');
      const headers = init?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-access-token');

      return new Response(JSON.stringify({ id: 'spotify-user-1', display_name: 'Test User' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const tokenProvider = createStaticTokenProvider('test-access-token');
    const client = new SpotifyHttpClient({
      tokenProvider,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await client.get<{ id: string; display_name: string }>('/v1/me');
    expect(result.id).toBe('spotify-user-1');
    expect(result.display_name).toBe('Test User');
  });

  it('14. handles Spotify 401 unauthorized as non-retryable SpotifyApiError', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { status: 401, message: 'The access token expired' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('expired-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.get('/v1/me');
      expect.unreachable('Expected SpotifyApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyApiError);
      const apiErr = err as SpotifyApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.retryable).toBe(false);
      expect(apiErr.endpoint).toBe('/v1/me');
      expect(apiErr.message).toContain('The access token expired');
    }
  });

  it('15. handles Spotify 403 forbidden as non-retryable SpotifyApiError', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { status: 403, message: 'Insufficient client scope' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.get('/v1/playlists/123');
      expect.unreachable('Expected SpotifyApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyApiError);
      const apiErr = err as SpotifyApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.retryable).toBe(false);
      expect(apiErr.message).toContain('Insufficient client scope');
    }
  });

  it('16. handles Spotify 429 rate limiting as a typed retryable error with Retry-After', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { status: 429, message: 'API rate limit exceeded' } }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '5',
          },
        }
      );
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.get('/v1/search');
      expect.unreachable('Expected SpotifyApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyApiError);
      const apiErr = err as SpotifyApiError;
      expect(apiErr.status).toBe(429);
      expect(apiErr.retryable).toBe(true);
      expect(apiErr.retryAfterSeconds).toBe(5);
      expect(apiErr.message).toContain('API rate limit exceeded');
    }
  });

  it('17. handles Spotify 5xx server errors as retryable errors', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { status: 502, message: 'Bad Gateway' } }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.get('/v1/browse/new-releases');
      expect.unreachable('Expected SpotifyApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyApiError);
      const apiErr = err as SpotifyApiError;
      expect(apiErr.status).toBe(502);
      expect(apiErr.retryable).toBe(true);
    }
  });

  it('18. handles malformed non-JSON responses gracefully', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('<html>502 Bad Gateway Nginx</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.get('/v1/me');
      expect.unreachable('Expected SpotifyApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyApiError);
      const apiErr = err as SpotifyApiError;
      expect(apiErr.message).toContain('Malformed non-JSON response');
    }
  });

  it('throws SpotifyAuthError when token is expired and cannot be refreshed', async () => {
    const expiredToken: SpotifyToken = {
      accessToken: 'old-access-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      obtainedAt: Date.now() - 3600 * 1000,
    };

    const tokenManager = new SpotifyTokenManager({
      initialToken: expiredToken,
    });

    await expect(tokenManager.getValidAccessToken()).rejects.toThrow(SpotifyAuthError);
  });

  it('automatically refreshes token via SpotifyTokenManager when inside safety window', async () => {
    const expiredToken: SpotifyToken = {
      accessToken: 'old-access-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshToken: 'test-refresh-token',
      obtainedAt: Date.now() - 3600 * 1000, // already expired
    };

    const mockOAuthService: Partial<SpotifyOAuthService> = {
      refreshAccessToken: vi.fn(async () => {
        return {
          accessToken: 'freshly-refreshed-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          refreshToken: 'test-refresh-token',
          obtainedAt: Date.now(),
        };
      }),
    };

    const tokenManager = new SpotifyTokenManager({
      initialToken: expiredToken,
      oauthService: mockOAuthService as SpotifyOAuthService,
    });

    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer freshly-refreshed-token');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new SpotifyHttpClient({
      tokenProvider: tokenManager,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.get<{ ok: boolean }>('/v1/test');
    expect(res.ok).toBe(true);
    expect(mockOAuthService.refreshAccessToken).toHaveBeenCalledTimes(1);

    // Second request within validity should NOT refresh again
    await client.get<{ ok: boolean }>('/v1/test');
    expect(mockOAuthService.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('21. ensures secrets never appear in thrown error messages', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const sensitiveToken = 'super-secret-bearer-token-12345';
    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider(sensitiveToken),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.get('/v1/me');
      expect.unreachable('Expected SpotifyApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyApiError);
      const apiErr = err as SpotifyApiError;
      expect(apiErr.message).not.toContain(sensitiveToken);
    }
  });
});
