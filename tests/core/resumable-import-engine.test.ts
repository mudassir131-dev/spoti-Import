import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportEngine,
  InMemoryCheckpointStore,
  MAX_IMPORT_TRACKS,
  DestinationError,
  type MusicSource,
  type MusicDestination,
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

describe('ImportEngine - Resumable Pipeline & Checkpoint Recovery', () => {
  let checkpointStore: InMemoryCheckpointStore;
  let writtenBatches: ImportedTrack[][];
  let mockDestination: MusicDestination;

  beforeEach(() => {
    checkpointStore = new InMemoryCheckpointStore();
    writtenBatches = [];

    mockDestination = {
      name: 'mock-destination',
      writeTracks: vi.fn(async (_jobId: string, tracks: readonly ImportedTrack[]) => {
        writtenBatches.push([...tracks]);
        return { writtenCount: tracks.length };
      }),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };
  });

  it('1. Fresh import checkpoints progress at safe batch boundaries and completes', async () => {
    const totalTracks = 10;
    const batchSize = 3;
    const tracks = Array.from({ length: totalTracks }, (_, i) => createSampleTrack(`t-${i + 1}`));

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: playlistId,
        title: 'Playlist 1',
        totalTracks,
      })),
      getTracks: vi.fn(async (_playlistId: string): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: totalTracks,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
      checkpointStore,
      defaultBatchSize: batchSize,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-checkpoint-1',
      jobId: 'job-fresh-1',
      batchSize,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(10);
    // 10 tracks with batch size 3 => 4 batches (3, 3, 3, 1)
    expect(writtenBatches.length).toBe(4);

    const savedCheckpoint = await checkpointStore.load('job-fresh-1');
    expect(savedCheckpoint).not.toBeNull();
    expect(savedCheckpoint?.status).toBe('completed');
    expect(savedCheckpoint?.writtenTracks).toBe(10);
    expect(savedCheckpoint?.processedTracks).toBe(10);
    expect(savedCheckpoint?.currentBatch).toBe(4);
  });

  it('2. Interrupted/failed import leaves a resumable checkpoint', async () => {
    const totalTracks = 10;
    const batchSize = 3;
    const tracks = Array.from({ length: totalTracks }, (_, i) => createSampleTrack(`t-${i + 1}`));

    let callCount = 0;
    const failingDestination: MusicDestination = {
      name: 'failing-destination',
      writeTracks: vi.fn(async (_jobId: string, batchTracks: readonly ImportedTrack[]) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network timeout during batch 2');
        }
        writtenBatches.push([...batchTracks]);
        return { writtenCount: batchTracks.length };
      }),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: playlistId,
        title: 'Playlist 1',
        totalTracks,
      })),
      getTracks: vi.fn(async (_playlistId: string): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: totalTracks,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: failingDestination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-fail-1',
      jobId: 'job-fail-1',
      batchSize,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(DestinationError);

    // Batch 1 was successfully written and checkpointed before batch 2 failed
    const checkpoint = await checkpointStore.load('job-fail-1');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.status).toBe('failed');
    expect(checkpoint?.writtenTracks).toBe(3);
    expect(checkpoint?.processedTracks).toBe(3);
    expect(checkpoint?.currentBatch).toBe(1);
    expect(writtenBatches.length).toBe(1);
    expect(writtenBatches[0]!.map((t) => t.sourceId)).toEqual(['t-1', 't-2', 't-3']);
  });

  it('3. Resumed import does NOT re-write committed batches and completes successfully', async () => {
    const totalTracks = 10;
    const batchSize = 3;
    const tracks = Array.from({ length: totalTracks }, (_, i) => createSampleTrack(`t-${i + 1}`));

    // Pre-seed checkpoint as if batch 1 (3 tracks) was already committed
    await checkpointStore.save({
      importId: 'job-resume-1',
      sourceName: 'mock-source',
      sourceReference: 'pl-resume-1',
      processedTracks: 3,
      writtenTracks: 3,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 1,
      currentPage: 1,
      lastProcessedSourceId: 't-3',
      isTruncated: false,
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: playlistId,
        title: 'Playlist 1',
        totalTracks,
      })),
      getTracks: vi.fn(async (_playlistId: string): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: totalTracks,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-resume-1',
      jobId: 'job-resume-1',
      batchSize,
    });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.progress.writtenTracks).toBe(10);

    // Written batches should ONLY contain tracks 4-10:
    // batch 2: [t-4, t-5, t-6]
    // batch 3: [t-7, t-8, t-9]
    // batch 4: [t-10]
    expect(writtenBatches.length).toBe(3);
    const resumedTrackIds = writtenBatches.flatMap((b) => b.map((t) => t.sourceId));
    expect(resumedTrackIds).toEqual(['t-4', 't-5', 't-6', 't-7', 't-8', 't-9', 't-10']);
    expect(resumedTrackIds).not.toContain('t-1');
    expect(resumedTrackIds).not.toContain('t-2');
    expect(resumedTrackIds).not.toContain('t-3');

    // Updated checkpoint reflects completion
    const finalCheckpoint = await checkpointStore.load('job-resume-1');
    expect(finalCheckpoint?.status).toBe('completed');
    expect(finalCheckpoint?.writtenTracks).toBe(10);
  });

  it('4. Resumed import preserves exact playlist ordering across streaming sources', async () => {
    const totalTracks = 8;
    const batchSize = 2;
    const tracks = Array.from({ length: totalTracks }, (_, i) => createSampleTrack(`ord-${i + 1}`));

    // Pre-seed checkpoint after batch 2 (4 tracks written: ord-1, ord-2, ord-3, ord-4)
    await checkpointStore.save({
      importId: 'job-stream-order',
      sourceName: 'mock-streaming-source',
      sourceReference: 'pl-stream-1',
      processedTracks: 4,
      writtenTracks: 4,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 2,
      currentPage: 2,
      lastProcessedSourceId: 'ord-4',
      isTruncated: false,
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockSource: MusicSource = {
      name: 'mock-streaming-source',
      getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => ({
        source: 'mock-streaming-source',
        sourceId: playlistId,
        title: 'Streaming Playlist',
        totalTracks,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (const t of tracks) {
          yield t;
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-stream-1',
      jobId: 'job-stream-order',
      batchSize,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(8);

    // Written batches should be ord-5..ord-8 in exact order
    const writtenIds = writtenBatches.flatMap((b) => b.map((t) => t.sourceId));
    expect(writtenIds).toEqual(['ord-5', 'ord-6', 'ord-7', 'ord-8']);
  });

  it('5. Resumed import respects MAX_IMPORT_TRACKS limit and preserves truncation metadata', async () => {
    const totalTracks = 10005;
    const batchSize = 2000;

    // Suppose first 8,000 tracks were written in 4 batches
    await checkpointStore.save({
      importId: 'job-truncation-resume',
      sourceName: 'mock-source',
      sourceReference: 'pl-large',
      processedTracks: 8000,
      writtenTracks: 8000,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 4,
      currentPage: 4,
      isTruncated: true,
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: playlistId,
        title: 'Large Playlist',
        totalTracks,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 0; i < totalTracks; i++) {
          yield createSampleTrack(`large-${i + 1}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-large',
      jobId: 'job-truncation-resume',
      batchSize,
    });

    expect(result.success).toBe(true);
    // Total written should hit exactly MAX_IMPORT_TRACKS (10,000)
    expect(result.progress.writtenTracks).toBe(MAX_IMPORT_TRACKS);
    expect(result.isTruncated).toBe(true);
    expect(result.job.isTruncated).toBe(true);

    // In this resume run, exactly 2000 tracks were written (8000 + 2000 = 10000)
    const newlyWrittenCount = writtenBatches.reduce((acc, b) => acc + b.length, 0);
    expect(newlyWrittenCount).toBe(2000);
  });

  it('6. Completed import is not re-executed unless forceRestart is requested', async () => {
    await checkpointStore.save({
      importId: 'job-already-done',
      sourceName: 'mock-source',
      sourceReference: 'pl-done',
      processedTracks: 50,
      writtenTracks: 50,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 5,
      currentPage: 5,
      isTruncated: false,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (): Promise<ImportedPlaylist> => {
        throw new Error('Source should not be called for completed import!');
      }),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => {
        throw new Error('Source tracks should not be called for completed import!');
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
      checkpointStore,
    });

    // 1st call: returns completed result immediately without calling source or destination
    const result = await engine.importPlaylist({
      playlistId: 'pl-done',
      jobId: 'job-already-done',
    });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.progress.writtenTracks).toBe(50);
    expect(mockSource.getPlaylist).not.toHaveBeenCalled();
    expect(mockDestination.writeTracks).not.toHaveBeenCalled();

    // 2nd call with forceRestart: true will restart
    const restartSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: 'pl-done',
        title: 'Restarted Playlist',
        totalTracks: 2,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: [createSampleTrack('r-1'), createSampleTrack('r-2')],
        hasMore: false,
        total: 2,
      })),
    };

    const restartEngine = new ImportEngine({
      source: restartSource,
      destination: mockDestination,
      checkpointStore,
    });

    const restartResult = await restartEngine.importPlaylist({
      playlistId: 'pl-done',
      jobId: 'job-already-done',
      forceRestart: true,
    });

    expect(restartResult.success).toBe(true);
    expect(restartSource.getPlaylist).toHaveBeenCalled();
    expect(mockDestination.writeTracks).toHaveBeenCalled();
  });
});
