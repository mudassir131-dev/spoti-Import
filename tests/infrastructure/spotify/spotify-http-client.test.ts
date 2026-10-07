import { describe, it, expect, vi } from 'vitest';
import { SpotifyHttpClient, createStaticTokenProvider } from '../../../src/infrastructure/spotify/client/index.js';

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
  });
});
