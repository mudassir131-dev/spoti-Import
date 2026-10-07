import { describe, it, expect } from 'vitest';
import {
  InMemoryMusicSource,
  InMemoryMusicDestination,
  ImportEngine,
  type ImportedTrack,
} from '../../src/index.js';

describe('InMemory Adapters & End-to-End Core Integration', () => {
  it('successfully moves tracks from InMemoryMusicSource to InMemoryMusicDestination', async () => {
    const sampleTracks: ImportedTrack[] = [
      {
        source: 'in-memory-source',
        sourceId: 'track-1',
        title: 'Song One',
        artists: [{ name: 'Artist One' }],
      },
      {
        source: 'in-memory-source',
        sourceId: 'track-2',
        title: 'Song Two',
        artists: [{ name: 'Artist Two' }],
      },
    ];

    const source = new InMemoryMusicSource('source-mem', {
      'fav-playlist': {
        playlist: {
          source: 'source-mem',
          sourceId: 'fav-playlist',
          title: 'Favorites',
          totalTracks: 2,
        },
        tracks: sampleTracks,
      },
    });

    const destination = new InMemoryMusicDestination('dest-mem');

    const engine = new ImportEngine({
      source,
      destination,
      defaultBatchSize: 1,
    });

    const result = await engine.importPlaylist({ playlistId: 'fav-playlist' });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(destination.committedJobs.has(result.job.id)).toBe(true);

    const committed = destination.getCommittedTracks(result.job.id);
    expect(committed).toHaveLength(2);
    expect(committed[0]?.title).toBe('Song One');
    expect(committed[1]?.title).toBe('Song Two');
  });
});
