import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportEngine,
  InMemoryMusicDestination,
  InMemoryCheckpointStore,
  ImportCancelledError,
  SourceError,
  DestinationError,
  ValidationError,
  type MusicSource,
  type ImportedTrack,
  type TrackNormalizer,
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

describe('ImportEngine - Cancellation & Failure Recovery Lifecycle (PR 4)', () => {
  let destination: InMemoryMusicDestination;
  let checkpointStore: InMemoryCheckpointStore;

  beforeEach(() => {
    destination = new InMemoryMusicDestination('recovery-destination');
    checkpointStore = new InMemoryCheckpointStore();
  });

  it('1. Cancellation before start stops execution immediately and marks job cancelled', async () => {
    const controller = new AbortController();
    controller.abort(); // Cancelled before invocation

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(),
      getTracks: vi.fn(),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-pre-cancel',
      jobId: 'job-pre-cancel',
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('cancelled');
    expect(result.progress.status).toBe('cancelled');
    expect(result.error).toBeInstanceOf(ImportCancelledError);
    expect(mockSource.getPlaylist).not.toHaveBeenCalled();
    expect(mockSource.getTracks).not.toHaveBeenCalled();
  });

  it('2. In-flight cancellation stops future processing and preserves committed batches', async () => {
    const controller = new AbortController();
    const tracks = Array.from({ length: 6 }, (_, i) => createSampleTrack(`c-${i + 1}`));

    // We abort after batch 1 is written
    const originalWrite = destination.writeTracks.bind(destination);
    destination.writeTracks = vi.fn(async (jobId, bTracks, signal, context) => {
      const res = await originalWrite(jobId, bTracks, signal, context);
      if (context?.batchIndex === 1) {
        controller.abort(); // abort right after batch 1 commits
      }
      return res;
    });

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string) => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Cancel Mid-flight',
        totalTracks: 6,
      })),
      getTracks: vi.fn(async () => ({
        tracks,
        hasMore: false,
        total: 6,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-cancel-mid',
      jobId: 'job-cancel-mid',
      batchSize: 2,
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('cancelled');
    expect(result.progress.status).toBe('cancelled');
    expect(result.error).toBeInstanceOf(ImportCancelledError);

    // Batch 1 (2 tracks: c-1, c-2) was committed before abort
    const committed = destination.getCommittedTracks('job-cancel-mid');
    expect(committed.length).toBe(2);
    expect(committed.map((t) => t.sourceId)).toEqual(['c-1', 'c-2']);

    // Checkpoint must be saved in 'cancelled' state with 2 processed tracks
    const cp = await checkpointStore.load('job-cancel-mid');
    expect(cp).not.toBeNull();
    expect(cp?.status).toBe('cancelled');
    expect(cp?.writtenTracks).toBe(2);
    expect(cp?.processedTracks).toBe(2);
  });

  it('3. Resuming a cancelled job continues from checkpoint and completes remaining tracks', async () => {
    // Pre-seed a cancelled checkpoint after 2 tracks
    await checkpointStore.save({
      importId: 'job-resume-cancelled',
      sourceName: 'mock-source',
      sourceReference: 'pl-cancel-resume',
      processedTracks: 2,
      writtenTracks: 2,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 1,
      currentPage: 1,
      isTruncated: false,
      status: 'cancelled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Write batch 1 directly to destination so it reflects prior state
    await destination.writeTracks(
      'job-resume-cancelled',
      [createSampleTrack('c-1'), createSampleTrack('c-2')],
      undefined,
      { batchId: 'job-resume-cancelled:batch:1', batchIndex: 1, trackCount: 2 }
    );
    await destination.commit('job-resume-cancelled');

    const allTracks = Array.from({ length: 5 }, (_, i) => createSampleTrack(`c-${i + 1}`));
    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string) => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Cancel Resumed Playlist',
        totalTracks: 5,
      })),
      getTracks: vi.fn(async () => ({
        tracks: allTracks,
        hasMore: false,
        total: 5,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2,
    });

    const resumeResult = await engine.importPlaylist({
      playlistId: 'pl-cancel-resume',
      jobId: 'job-resume-cancelled',
      batchSize: 2,
    });

    expect(resumeResult.success).toBe(true);
    expect(resumeResult.job.status).toBe('completed');
    expect(resumeResult.progress.writtenTracks).toBe(5);

    const committed = destination.getCommittedTracks('job-resume-cancelled');
    expect(committed.length).toBe(5);
    expect(committed.map((t) => t.sourceId)).toEqual(['c-1', 'c-2', 'c-3', 'c-4', 'c-5']);

    const finalCp = await checkpointStore.load('job-resume-cancelled');
    expect(finalCp?.status).toBe('completed');
  });

  it('4. Source failure results in deterministic failed status', async () => {
    const mockSource: MusicSource = {
      name: 'faulty-source',
      getPlaylist: vi.fn(async () => {
        throw new Error('Spotify 503 Service Unavailable');
      }),
      getTracks: vi.fn(),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-source-fail',
      jobId: 'job-source-fail',
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.progress.status).toBe('failed');
    expect(result.error).toBeInstanceOf(SourceError);
  });

  it('5. Destination failure results in deterministic failed status and rolls back uncommitted batch', async () => {
    const failingDestination: InMemoryMusicDestination = new InMemoryMusicDestination('fail-sink');
    failingDestination.writeTracks = vi.fn(async () => {
      throw new Error('Disk full I/O error');
    });

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async () => ({
        source: 'mock-source',
        sourceId: 'pl-dest-fail',
        title: 'Dest Fail',
        totalTracks: 2,
      })),
      getTracks: vi.fn(async () => ({
        tracks: [createSampleTrack('1'), createSampleTrack('2')],
        hasMore: false,
        total: 2,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: failingDestination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-dest-fail',
      jobId: 'job-dest-fail',
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.error).toBeInstanceOf(DestinationError);
    expect(failingDestination.rolledBackJobs.has('job-dest-fail')).toBe(true);
  });

  it('6. Track normalizer failure results in deterministic failed status', async () => {
    const failingNormalizer: TrackNormalizer = {
      normalize: vi.fn(() => {
        throw new Error('Corrupt artist field cannot be parsed');
      }),
    };

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async () => ({
        source: 'mock-source',
        sourceId: 'pl-norm-fail',
        title: 'Norm Fail',
        totalTracks: 1,
      })),
      getTracks: vi.fn(async () => ({
        tracks: [createSampleTrack('1')],
        hasMore: false,
        total: 1,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      normalizer: failingNormalizer,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-norm-fail',
      jobId: 'job-norm-fail',
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error?.message).toContain('Normalization failed');
  });

  it('7. Unexpected runtime exception results in deterministic failed status', async () => {
    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async () => {
        throw 'Unexpected non-error string threw unexpectedly';
      }),
      getTracks: vi.fn(),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-unexpected',
      jobId: 'job-unexpected',
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.error).toBeInstanceOf(SourceError);
  });
});
