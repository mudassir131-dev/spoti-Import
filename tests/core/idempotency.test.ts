import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportEngine,
  InMemoryMusicDestination,
  InMemoryCheckpointStore,
  type MusicSource,
  type ImportedTrack,
  type ImportedPlaylist,
  type SourceTrackPage,
} from '../../src/index.js';

function createSampleTrack(id: string, overrides: Partial<ImportedTrack> = {}): ImportedTrack {
  return {
    source: 'mock-source',
    sourceId: id,
    title: `Track ${id}`,
    artists: [{ name: `Artist ${id}`, sourceId: `art-${id}` }],
    album: {
      title: `Album ${id}`,
      sourceId: `alb-${id}`,
      releaseDate: '2025-01-01',
    },
    durationMs: 180000,
    isrc: `USRC1234567${id.padStart(2, '0')}`,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    metadata: { sampleKey: 'sampleValue' },
    ...overrides,
  };
}

describe('ImportEngine & InMemoryDestination - Idempotency & Batch Isolation (PR 3)', () => {
  let destination: InMemoryMusicDestination;
  let checkpointStore: InMemoryCheckpointStore;

  beforeEach(() => {
    destination = new InMemoryMusicDestination('test-in-memory-sink');
    checkpointStore = new InMemoryCheckpointStore();
  });

  it('1. Same import cannot accidentally commit identical batch twice', async () => {
    const tracks = [createSampleTrack('t-1'), createSampleTrack('t-2')];

    // Manual write test directly on destination port
    const batch1 = await destination.writeTracks('job-idemp-1', tracks, undefined, {
      batchId: 'job-idemp-1:batch:1',
      batchIndex: 1,
      trackCount: 2,
    });
    expect(batch1.writtenCount).toBe(2);

    // Duplicate call with same batchId
    const duplicateBatch1 = await destination.writeTracks('job-idemp-1', tracks, undefined, {
      batchId: 'job-idemp-1:batch:1',
      batchIndex: 1,
      trackCount: 2,
    });
    expect(duplicateBatch1.writtenCount).toBe(0);

    await destination.commit('job-idemp-1');

    const committed = destination.getCommittedTracks('job-idemp-1');
    expect(committed.length).toBe(2);
    expect(committed.map((t) => t.sourceId)).toEqual(['t-1', 't-2']);
  });

  it('2. Retrying a failed batch is safe and does not produce duplicate tracks', async () => {
    // Playlist with 4 tracks: batch 1 has 2 tracks, batch 2 has 2 tracks
    const allTracks = [
      createSampleTrack('t-1'),
      createSampleTrack('t-2'),
      createSampleTrack('t-3'),
      createSampleTrack('t-4'),
    ];

    let simulateFailBatch2Once = true;
    const flakeyDestination = new InMemoryMusicDestination('flakey-destination');
    const originalWrite = flakeyDestination.writeTracks.bind(flakeyDestination);

    flakeyDestination.writeTracks = vi.fn(async (jobId, tracks, signal, context) => {
      if (context?.batchIndex === 2 && simulateFailBatch2Once) {
        simulateFailBatch2Once = false;
        throw new Error('Simulated network failure on batch 2');
      }
      return originalWrite(jobId, tracks, signal, context);
    });

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Retry Test Playlist',
        totalTracks: 4,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: allTracks,
        hasMore: false,
        total: 4,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: flakeyDestination,
      checkpointStore,
      defaultBatchSize: 2,
    });

    // 1st run: fails on batch 2
    const firstResult = await engine.importPlaylist({
      playlistId: 'pl-retry-1',
      jobId: 'job-retry-1',
      batchSize: 2,
    });
    expect(firstResult.success).toBe(false);

    // 2nd run: resume / retry with the same jobId
    const secondResult = await engine.importPlaylist({
      playlistId: 'pl-retry-1',
      jobId: 'job-retry-1',
      batchSize: 2,
    });
    expect(secondResult.success).toBe(true);

    const committed = flakeyDestination.getCommittedTracks('job-retry-1');
    expect(committed.length).toBe(4);
    expect(committed.map((t) => t.sourceId)).toEqual(['t-1', 't-2', 't-3', 't-4']);
  });

  it('3. Playlist duplicate occurrences remain preserved when deduplicate=false', async () => {
    // Playlist: A, B, A
    const playlistWithDuplicates = [
      createSampleTrack('track-A'),
      createSampleTrack('track-B'),
      createSampleTrack('track-A'),
    ];

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Duplicate Preserving Playlist',
        totalTracks: 3,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: playlistWithDuplicates,
        hasMore: false,
        total: 3,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-dup-preserve',
      jobId: 'job-dup-preserve',
      deduplicate: false, // Explicit false
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(3);
    expect(result.progress.skippedTracks).toBe(0);

    const committed = destination.getCommittedTracks('job-dup-preserve');
    expect(committed.length).toBe(3);
    expect(committed.map((t) => t.sourceId)).toEqual(['track-A', 'track-B', 'track-A']);
  });

  it('4. Separate import jobs remain completely independent', async () => {
    const tracks = [createSampleTrack('shared-1'), createSampleTrack('shared-2')];

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Shared Tracks Playlist',
        totalTracks: 2,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: 2,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result1 = await engine.importPlaylist({
      playlistId: 'pl-shared',
      jobId: 'job-alpha',
    });

    const result2 = await engine.importPlaylist({
      playlistId: 'pl-shared',
      jobId: 'job-beta',
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    const tracksAlpha = destination.getCommittedTracks('job-alpha');
    const tracksBeta = destination.getCommittedTracks('job-beta');

    expect(tracksAlpha.length).toBe(2);
    expect(tracksBeta.length).toBe(2);
    expect(tracksAlpha.map((t) => t.sourceId)).toEqual(['shared-1', 'shared-2']);
    expect(tracksBeta.map((t) => t.sourceId)).toEqual(['shared-1', 'shared-2']);

    const checkpointAlpha = await checkpointStore.load('job-alpha');
    const checkpointBeta = await checkpointStore.load('job-beta');
    expect(checkpointAlpha?.importId).toBe('job-alpha');
    expect(checkpointBeta?.importId).toBe('job-beta');
  });

  it('5. deduplicate=true still behaves exactly as Phase 3 specifies', async () => {
    // Playlist: A, B, A, C, B
    const tracks = [
      createSampleTrack('track-A'),
      createSampleTrack('track-B'),
      createSampleTrack('track-A'),
      createSampleTrack('track-C'),
      createSampleTrack('track-B'),
    ];

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Deduplicated Playlist',
        totalTracks: 5,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: 5,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-dedup-active',
      jobId: 'job-dedup-active',
      deduplicate: true,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(3);
    expect(result.progress.skippedTracks).toBe(2);

    const committed = destination.getCommittedTracks('job-dedup-active');
    expect(committed.length).toBe(3);
    expect(committed.map((t) => t.sourceId)).toEqual(['track-A', 'track-B', 'track-C']);
  });
});
