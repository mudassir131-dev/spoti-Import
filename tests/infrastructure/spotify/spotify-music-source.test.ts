import { describe, it, expect, vi } from 'vitest';
import {
  SpotifyMusicSource,
  SpotifyHttpClient,
  createStaticTokenProvider,
  ImportEngine,
  InMemoryMusicDestination,
  SourceError,
} from '../../../src/index.js';

describe('SpotifyMusicSource Adapter & Normalization', () => {
  const fakePlaylistResponse = {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: 'Today\'s Top Hits',
    description: 'The hottest tracks right now.',
    owner: {
      id: 'spotify',
      display_name: 'Spotify',
    },
    images: [{ url: 'https://i.scdn.co/image/ab67706f00000002b55b' }],
    tracks: {
      total: 50,
      href: 'https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks',
    },
    uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
    snapshot_id: 'snapshot-abc-123',
  };

  const fakeTracksResponse = {
    href: 'https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks',
    items: [
      {
        track: {
          id: '11dFghVXANMlKmJXsNCbNl',
          name: 'Stay',
          artists: [
            { id: '2tIP7wua9q4JezrvcrW8Cu', name: 'The Kid LAROI' },
            { id: '1uNFoZAHBGtllmzznpCI3s', name: 'Justin Bieber' },
          ],
          album: {
            id: '4Gfnly5CzMJQqkUWFOHaP3',
            name: 'F*CK LOVE 3+: OVER YOU',
            release_date: '2021-07-23',
            total_tracks: 35,
            images: [{ url: 'https://i.scdn.co/image/stay-art' }],
            artists: [{ id: '2tIP7wua9q4JezrvcrW8Cu', name: 'The Kid LAROI' }],
          },
          duration_ms: 141806,
          explicit: true,
          track_number: 1,
          disc_number: 1,
          popularity: 88,
          is_playable: true,
          uri: 'spotify:track:11dFghVXANMlKmJXsNCbNl',
          external_ids: { isrc: 'USSM12104193' },
        },
      },
      // Track with minimal/missing optional metadata
      {
        track: {
          id: 'track-sparse-id',
          name: 'Sparse Track',
          artists: [],
          album: {
            name: 'Single Album',
          },
          duration_ms: 180000,
          explicit: false,
          track_number: 1,
          disc_number: 1,
        },
      },
      // Null item (e.g. podcast or deleted song) should be safely filtered
      {
        track: null,
      },
    ],
    limit: 100,
    next: null,
    offset: 0,
    total: 2,
  };

  it('19. normalizes Spotify playlist response into ImportedPlaylist domain model', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks')) {
        return new Response(JSON.stringify(fakeTracksResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(fakePlaylistResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const source = new SpotifyMusicSource(client);
    const playlist = await source.getPlaylist('37i9dQZF1DXcBWIGoYBM5M');

    expect(playlist.source).toBe('spotify');
    expect(playlist.sourceId).toBe('37i9dQZF1DXcBWIGoYBM5M');
    expect(playlist.title).toBe("Today's Top Hits");
    expect(playlist.description).toBe('The hottest tracks right now.');
    expect(playlist.owner).toBe('Spotify');
    expect(playlist.totalTracks).toBe(50);
    expect(playlist.artwork).toBe('https://i.scdn.co/image/ab67706f00000002b55b');
    expect(playlist.metadata).toMatchObject({
      uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      snapshotId: 'snapshot-abc-123',
    });
  });

  it('20. normalizes Spotify track response with complete and sparse/optional metadata', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify(fakeTracksResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const source = new SpotifyMusicSource(client);
    const trackPage = await source.getTracks('37i9dQZF1DXcBWIGoYBM5M');

    // 3 items in response, but 1 is null -> exactly 2 normalized tracks
    expect(trackPage.tracks).toHaveLength(2);
    expect(trackPage.hasMore).toBe(false);

    // Track 1: full metadata
    const firstTrack = trackPage.tracks[0]!;
    expect(firstTrack.source).toBe('spotify');
    expect(firstTrack.sourceId).toBe('11dFghVXANMlKmJXsNCbNl');
    expect(firstTrack.title).toBe('Stay');
    expect(firstTrack.artists).toHaveLength(2);
    expect(firstTrack.artists[0]?.name).toBe('The Kid LAROI');
    expect(firstTrack.artists[1]?.name).toBe('Justin Bieber');
    expect(firstTrack.album?.title).toBe('F*CK LOVE 3+: OVER YOU');
    expect(firstTrack.albumArtist).toBe('The Kid LAROI');
    expect(firstTrack.durationMs).toBe(141806);
    expect(firstTrack.explicit).toBe(true);
    expect(firstTrack.isrc).toBe('USSM12104193');
    expect(firstTrack.artwork).toBe('https://i.scdn.co/image/stay-art');
    expect(firstTrack.metadata).toMatchObject({
      uri: 'spotify:track:11dFghVXANMlKmJXsNCbNl',
      popularity: 88,
      isPlayable: true,
    });

    // Track 2: sparse metadata (missing artists defaulted safely)
    const secondTrack = trackPage.tracks[1]!;
    expect(secondTrack.sourceId).toBe('track-sparse-id');
    expect(secondTrack.title).toBe('Sparse Track');
    expect(secondTrack.artists[0]?.name).toBe('Unknown Artist');
    expect(secondTrack.album?.title).toBe('Single Album');
    expect(secondTrack.isrc).toBeUndefined();
    expect(secondTrack.artwork).toBeUndefined();
  });

  it('translates API error into typed domain SourceError', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const source = new SpotifyMusicSource(client);
    await expect(source.getPlaylist('non-existent')).rejects.toThrow(SourceError);
  });

  it('plugs seamlessly into Phase 1 ImportEngine without core modification', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/tracks')) {
        return new Response(JSON.stringify(fakeTracksResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(fakePlaylistResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new SpotifyHttpClient({
      tokenProvider: createStaticTokenProvider('test-access-token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const spotifySource = new SpotifyMusicSource(client);
    const destination = new InMemoryMusicDestination('in-memory-test-sink');

    const engine = new ImportEngine({
      source: spotifySource,
      destination,
    });

    const result = await engine.importPlaylist({
      playlistId: '37i9dQZF1DXcBWIGoYBM5M',
    });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.job.sourceName).toBe('spotify');
    expect(result.job.destinationName).toBe('in-memory-test-sink');
    expect(result.progress.writtenTracks).toBe(2);

    const committed = destination.getCommittedTracks(result.job.id);
    expect(committed).toHaveLength(2);
    expect(committed[0]?.title).toBe('Stay');
    expect(committed[1]?.title).toBe('Sparse Track');
  });
});
