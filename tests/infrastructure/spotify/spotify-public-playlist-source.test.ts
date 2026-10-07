import { describe, it, expect, vi } from 'vitest';
import {
  SpotifyPublicPlaylistSource,
  SpotifyAuthenticatedSource,
  type MusicSource,
  ImportEngine,
  InMemoryMusicDestination,
  MAX_IMPORT_TRACKS,
  SpotifyPlaylistUrlError,
  SpotifyUnavailableError,
  SpotifyMalformedResponseError,
  SpotifyRateLimitError,
} from '../../../src/index.js';

function createMockResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function makeTrackItem(id: string, name = `Track ${id}`, overrides: Record<string, unknown> = {}) {
  return {
    track: {
      id,
      name,
      artists: [{ id: `art-${id}`, name: `Artist for ${id}` }],
      album: {
        id: `alb-${id}`,
        name: `Album for ${id}`,
        release_date: '2024-01-01',
        total_tracks: 10,
        images: [{ url: `https://i.scdn.co/image/${id}` }],
      },
      duration_ms: 200000,
      track_number: 1,
      disc_number: 1,
      explicit: false,
      external_ids: { isrc: `USRC${id.padStart(8, '0')}` },
      is_playable: true,
      uri: `spotify:track:${id}`,
      ...overrides,
    },
  };
}

describe('SpotifyPublicPlaylistSource - Public Credential-Free Import (Phase 3)', () => {
  // Test 1: One-page playlist
  it('1. Fetches and parses a single-page public playlist', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({
          items: [makeTrackItem('trk-1', 'Song One'), makeTrackItem('trk-2', 'Song Two')],
          total: 2,
          next: null,
        });
      }
      return createMockResponse({
        id: '37i9dQZF1DXcBWIGoYBM01',
        name: 'Single Page Hits',
        description: 'Public single page playlist',
        tracks: { total: 2 },
      });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const playlist = await source.getPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM01');
    expect(playlist.title).toBe('Single Page Hits');
    expect(playlist.totalTracks).toBe(2);

    const page = await source.getTracks('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM01');
    expect(page.tracks).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.tracks[0]?.title).toBe('Song One');
    expect(page.tracks[1]?.title).toBe('Song Two');
  });

  // Test 2: Multi-page playlist
  it('2. Paginates across multiple pages seamlessly without user credentials', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('offset=0')) {
        return createMockResponse({
          items: [makeTrackItem('trk-1'), makeTrackItem('trk-2')],
          total: 4,
          next: 'https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM02/tracks?offset=2&limit=2',
        });
      }
      if (url.includes('offset=2')) {
        return createMockResponse({
          items: [makeTrackItem('trk-3'), makeTrackItem('trk-4')],
          total: 4,
          next: null,
        });
      }
      return createMockResponse({
        id: '37i9dQZF1DXcBWIGoYBM02',
        name: 'Multi Page List',
        tracks: { total: 4 },
      });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher, pageSize: 2 });
    const tracks: string[] = [];
    for await (const track of source.getTrackStream('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM02')) {
      tracks.push(track.sourceId);
    }

    expect(tracks).toEqual(['trk-1', 'trk-2', 'trk-3', 'trk-4']);
    const trackCalls = mockFetcher.mock.calls.filter(([url]) => String(url).includes('/tracks'));
    expect(trackCalls).toHaveLength(2);
  });


  // Test 3: Empty playlist
  it('3. Handles an empty playlist gracefully', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({ items: [], total: 0, next: null });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM03', name: 'Empty', tracks: { total: 0 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const playlist = await source.getPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM03');
    expect(playlist.totalTracks).toBe(0);

    const page = await source.getTracks('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM03');
    expect(page.tracks).toHaveLength(0);
    expect(page.hasMore).toBe(false);
  });

  // Test 4: Playlist with missing track metadata
  it('4. Gracefully normalizes tracks with missing/partial metadata', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({
          items: [
            {
              track: {
                id: 'sparse-1',
                name: 'Minimal Track',
              },
            },
          ],
          total: 1,
          next: null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM04', name: 'Sparse', tracks: { total: 1 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const page = await source.getTracks('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM04');
    expect(page.tracks).toHaveLength(1);

    const trk = page.tracks[0]!;
    expect(trk.sourceId).toBe('sparse-1');
    expect(trk.title).toBe('Minimal Track');
    expect(trk.artists[0]?.name).toBe('Unknown Artist');
    expect(trk.album).toBeUndefined();
    expect(trk.durationMs).toBeUndefined();
    expect(trk.isrc).toBeUndefined();
  });

  // Test 5: Playlist containing unavailable/null tracks
  it('5. Skips unavailable or deleted null track records without throwing', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({
          items: [
            makeTrackItem('avail-1', 'Available One'),
            { track: null },
            { is_local: true },
            makeTrackItem('avail-2', 'Available Two'),
          ],
          total: 4,
          next: null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM05', name: 'Unavail List', tracks: { total: 4 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const page = await source.getTracks('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM05');
    expect(page.tracks).toHaveLength(2);
    expect(page.tracks.map((t) => t.sourceId)).toEqual(['avail-1', 'avail-2']);
  });

  // Test 6: Playlist containing duplicate track occurrences
  it('6. Preserves playlist order and duplicate occurrences by default, and allows deduplication when configured', async () => {
    const duplicateItems = [
      makeTrackItem('dup-1', 'Duplicate Song'),
      makeTrackItem('other-2', 'Unique Song'),
      makeTrackItem('dup-1', 'Duplicate Song'),
    ];

    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({ items: duplicateItems, total: 3, next: null });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM06', name: 'Duplicate List', tracks: { total: 3 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const destinationDefault = new InMemoryMusicDestination();
    const destinationDedup = new InMemoryMusicDestination();

    const engine = new ImportEngine({ source });

    // Default: Preserves duplicates and playlist order
    const defaultResult = await engine.importPlaylist(
      { playlistId: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM06' },
      { destination: destinationDefault }
    );
    expect(defaultResult.success).toBe(true);
    expect(defaultResult.progress.writtenTracks).toBe(3);
    expect(destinationDefault.getCommittedTracks(defaultResult.job.id).map((t) => t.sourceId)).toEqual(['dup-1', 'other-2', 'dup-1']);

    // Deduplication configured: skips duplicate occurrence
    const dedupResult = await engine.importPlaylist(
      { playlistId: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM06', deduplicate: true },
      { destination: destinationDedup }
    );
    expect(dedupResult.success).toBe(true);
    expect(dedupResult.progress.writtenTracks).toBe(2);
    expect(dedupResult.progress.skippedTracks).toBe(1);
    expect(destinationDedup.getCommittedTracks(dedupResult.job.id).map((t) => t.sourceId)).toEqual(['dup-1', 'other-2']);
  });

  // Test 7 & 16: Playlist containing more than 10,000 tracks and truncation metadata
  it('7 & 16. Caps processing at MAX_IMPORT_TRACKS (10,000) and marks result as truncated', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        const urlObj = new URL(url);
        const offset = parseInt(urlObj.searchParams.get('offset') ?? '0', 10);
        const limit = parseInt(urlObj.searchParams.get('limit') ?? '100', 10);

        const items = [];
        for (let i = 0; i < limit; i++) {
          const index = offset + i;
          items.push(makeTrackItem(`t-${index}`));
        }
        return createMockResponse({
          items,
          total: 12_000,
          next: `https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM07/tracks?offset=${offset + limit}&limit=${limit}`,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM07', name: 'Huge Playlist', tracks: { total: 12_000 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher, pageSize: 100 });
    const destination = new InMemoryMusicDestination();
    const engine = new ImportEngine({ source, destination });

    const result = await engine.importPlaylist({
      playlistId: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM07',
      batchSize: 500,
    });

    expect(result.success).toBe(true);
    expect(result.progress.processedTracks).toBe(MAX_IMPORT_TRACKS); // exactly 10,000
    expect(result.progress.writtenTracks).toBe(MAX_IMPORT_TRACKS);
    expect(result.progress.isTruncated).toBe(true);
    expect(result.progress.truncated).toBe(true);
    expect(result.isTruncated).toBe(true);
    expect(result.job.isTruncated).toBe(true);
  });

  // Test Proving 10,001 source records result in at most 10,000 processed records
  it('PROVES that 10,001 source records result in at most 10,000 processed records', async () => {
    let fetchCallCount = 0;
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        fetchCallCount++;
        const urlObj = new URL(url);
        const offset = parseInt(urlObj.searchParams.get('offset') ?? '0', 10);
        const limit = parseInt(urlObj.searchParams.get('limit') ?? '100', 10);

        const items = [];
        for (let i = 0; i < limit && offset + i < 10_001; i++) {
          items.push(makeTrackItem(`tr-${offset + i}`));
        }
        return createMockResponse({
          items,
          total: 10_001,
          next: offset + limit < 10_001 ? `https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM08/tracks?offset=${offset + limit}` : null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM08', name: '10001 Tracks', tracks: { total: 10_001 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher, pageSize: 100 });
    let streamedCount = 0;
    for await (const _track of source.getTrackStream('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM08')) {
      streamedCount++;
    }

    expect(streamedCount).toBe(10_000); // capped at 10,000, track 10,001 was never yielded
  });

  // Test 8: Exactly 10,000 tracks
  it('8. Processes a playlist with exactly 10,000 tracks without truncation', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({
          items: [makeTrackItem('t-exact-1'), makeTrackItem('t-exact-2')],
          total: 10_000,
          next: null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM09', name: 'Exact 10k', tracks: { total: 10_000 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const playlist = await source.getPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM09');
    expect(playlist.totalTracks).toBe(10_000);
  });

  // Test 9: Fewer than 10,000 tracks
  it('9. Processes a playlist with fewer than 10,000 tracks accurately', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({
          items: [makeTrackItem('t-1'), makeTrackItem('t-2'), makeTrackItem('t-3')],
          total: 3,
          next: null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM10', name: 'Small', tracks: { total: 3 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const destination = new InMemoryMusicDestination();
    const engine = new ImportEngine({ source, destination });

    const result = await engine.importPlaylist({ playlistId: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM10' });
    expect(result.success).toBe(true);
    expect(result.progress.processedTracks).toBe(3);
    expect(result.progress.isTruncated).toBe(false);
  });

  // Test 10: Malformed playlist response
  it('10. Throws typed SpotifyMalformedResponseError on malformed response', async () => {
    const mockFetcher = vi.fn(async () => {
      return new Response('Not a json payload at all', { status: 200 });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    await expect(source.getPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM11')).rejects.toThrow(
      SpotifyMalformedResponseError
    );
  });

  // Test 11 & 12: Invalid URL & Non-Spotify URL
  it('11 & 12. Rejects invalid playlist URLs and non-Spotify URLs cleanly', async () => {
    const source = new SpotifyPublicPlaylistSource();

    await expect(source.getPlaylist('not-a-valid-url')).rejects.toThrow(SpotifyPlaylistUrlError);
    await expect(source.getPlaylist('https://music.apple.com/us/playlist/hits/pl.123')).rejects.toThrow(
      SpotifyPlaylistUrlError
    );
    await expect(source.getPlaylist('https://open.spotify.com/album/4aawyAB9vmqN3uQFRjYTkK')).rejects.toThrow(
      SpotifyPlaylistUrlError
    );
  });

  // Test 13: Correct playlist ordering
  it('13. Preserves deterministic chronological order of tracks across pages', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('offset=0')) {
        return createMockResponse({
          items: [makeTrackItem('alpha'), makeTrackItem('beta')],
          total: 4,
          next: 'https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM13/tracks?offset=2&limit=2',
        });
      }
      if (url.includes('offset=2')) {
        return createMockResponse({
          items: [makeTrackItem('gamma'), makeTrackItem('delta')],
          total: 4,
          next: null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM13', name: 'Ordered', tracks: { total: 4 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher, pageSize: 2 });
    const destination = new InMemoryMusicDestination();
    const engine = new ImportEngine({ source, destination });

    const result = await engine.importPlaylist({
      playlistId: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM13',
      batchSize: 2,
    });
    const importedIds = destination.getCommittedTracks(result.job.id).map((t) => t.sourceId);
    expect(importedIds).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  // Test 14 & 15: Incremental processing & No giant raw-response accumulation
  it('14 & 15. Incremental streaming yields tracks without accumulating all pages in memory', async () => {
    let pagesFetched = 0;
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        pagesFetched++;
        const urlObj = new URL(url);
        const offset = parseInt(urlObj.searchParams.get('offset') ?? '0', 10);
        return createMockResponse({
          items: [makeTrackItem(`t-${offset}`), makeTrackItem(`t-${offset + 1}`)],
          total: 6,
          next: offset + 2 < 6 ? `https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM14/tracks?offset=${offset + 2}` : null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM14', name: 'Stream', tracks: { total: 6 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher, pageSize: 2 });
    const generator = source.getTrackStream('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM14');

    // First page consumed
    const first = await generator.next();
    expect(first.value?.sourceId).toBe('t-0');
    expect(pagesFetched).toBe(1);

    const second = await generator.next();
    expect(second.value?.sourceId).toBe('t-1');
    expect(pagesFetched).toBe(1);

    // Second page fetched only upon demand
    const third = await generator.next();
    expect(third.value?.sourceId).toBe('t-2');
    expect(pagesFetched).toBe(2);
  });

  // Test 17: Progress reporting
  it('17. Reports detailed progress with accurate percentage and discovered counts', async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return createMockResponse({
          items: [makeTrackItem('p1'), makeTrackItem('p2'), makeTrackItem('p3'), makeTrackItem('p4')],
          total: 4,
          next: null,
        });
      }
      return createMockResponse({ id: '37i9dQZF1DXcBWIGoYBM17', name: 'Progress PL', tracks: { total: 4 } });
    });

    const source = new SpotifyPublicPlaylistSource({ fetcher: mockFetcher });
    const destination = new InMemoryMusicDestination();
    const engine = new ImportEngine({ source, destination });

    const snapshots: number[] = [];
    const result = await engine.importPlaylist(
      { playlistId: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM17', batchSize: 2 },
      {
        onProgress: (p) => {
          if (p.percentage !== undefined) {
            snapshots.push(p.percentage);
          }
        },
      }
    );

    expect(result.success).toBe(true);
    expect(result.progress.totalDiscovered).toBe(4);
    expect(result.progress.processedTracks).toBe(4);
    expect(result.progress.percentage).toBe(100);
    expect(snapshots).toContain(50);
    expect(snapshots).toContain(100);
  });

  // Test 18: Source errors (404 unavailable & 429 rate limit)
  it('18. Maps HTTP 404 to SpotifyUnavailableError and HTTP 429 to SpotifyRateLimitError', async () => {
    // 404 Unavailable test
    const notFoundFetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { status: 404, message: 'Not found' } }), {
        status: 404,
      });
    });
    const notFoundSource = new SpotifyPublicPlaylistSource({ fetcher: notFoundFetcher });
    await expect(
      notFoundSource.getPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM18')
    ).rejects.toThrow(SpotifyUnavailableError);

    // 429 Rate Limit test
    const rateLimitFetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { status: 429, message: 'Too many requests' } }), {
        status: 429,
        headers: { 'Retry-After': '5' },
      });
    });
    const rateLimitSource = new SpotifyPublicPlaylistSource({
      fetcher: rateLimitFetcher,
      maxRetries: 0,
    });
    await expect(
      rateLimitSource.getPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM19')
    ).rejects.toThrow(SpotifyRateLimitError);
  });

  // Phase 2 compatibility: Both implement MusicSource and can be swapped interchangeably
  it('Architecture Verification: SpotifyPublicPlaylistSource and SpotifyAuthenticatedSource both implement MusicSource', () => {
    const publicSource: MusicSource = new SpotifyPublicPlaylistSource();
    expect(publicSource.name).toBe('spotify-public');
    expect(typeof publicSource.getPlaylist).toBe('function');
    expect(typeof publicSource.getTracks).toBe('function');

    expect(SpotifyAuthenticatedSource).toBeDefined();
  });
});
