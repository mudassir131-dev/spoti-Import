import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportEngine,
  MAX_IMPORT_TRACKS,
  DEFAULT_BATCH_SIZE,
  ValidationError,
  SourceError,
  DestinationError,
  ImportLimitError,
  ImportCancelledError,
  type MusicSource,
  type MusicDestination,
  type ImportedTrack,
  type ImportedPlaylist,
  type ImportProgress,
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

function createSamplePlaylist(id = 'playlist-1', totalTracks = 3): ImportedPlaylist {
  return {
    source: 'mock-source',
    sourceId: id,
    title: 'Test Playlist',
    description: 'A test playlist',
    totalTracks,
  };
}

describe('ImportEngine - Core Lifecycle and Contracts', () => {
  let mockSource: MusicSource;
  let mockDestination: MusicDestination;

  beforeEach(() => {
    mockSource = {
      name: 'test-source',
      getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => {
        return createSamplePlaylist(playlistId, 3);
      }),
      getTracks: vi.fn(async (_playlistId: string): Promise<SourceTrackPage> => {
        return {
          tracks: [
            createSampleTrack('1'),
            createSampleTrack('2'),
            createSampleTrack('3'),
          ],
          hasMore: false,
          total: 3,
        };
      }),
    };

    mockDestination = {
      name: 'test-destination',
      writeTracks: vi.fn(async (_jobId: string, tracks: readonly ImportedTrack[]) => {
        return { writtenCount: tracks.length };
      }),
      commit: vi.fn(async (_jobId: string) => {}),
      rollback: vi.fn(async (_jobId: string, _cause?: unknown) => {}),
    };
  });

  // Test 1: Execution with mock source and mock destination
  it('1. ImportEngine can execute with a mock source and mock destination', async () => {
    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
    });

    const result = await engine.importPlaylist({ playlistId: 'pl-123' });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.job.status).toBe('completed');
    expect(result.job.playlistId).toBe('pl-123');
    expect(result.job.sourceName).toBe('test-source');
    expect(result.job.destinationName).toBe('test-destination');
    expect(result.job.completedAt).toBeDefined();

    expect(mockSource.getPlaylist).toHaveBeenCalledWith('pl-123', undefined);
    expect(mockSource.getTracks).toHaveBeenCalledWith('pl-123', {
      limit: MAX_IMPORT_TRACKS,
      signal: undefined,
    });
    expect(mockDestination.commit).toHaveBeenCalledWith(result.job.id);
    expect(mockDestination.rollback).not.toHaveBeenCalled();
  });

  // Test 2: Tracks are passed through the pipeline correctly
  it('2. Tracks are passed through the pipeline correctly', async () => {
    const sampleTracks = [
      createSampleTrack('101', { title: 'First Song', durationMs: 210000 }),
      createSampleTrack('102', { title: 'Second Song', explicit: true }),
    ];

    mockSource.getTracks = vi.fn(async () => ({
      tracks: sampleTracks,
      hasMore: false,
      total: 2,
    }));

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
    });

    const result = await engine.importPlaylist({ playlistId: 'pl-123' });

    expect(result.success).toBe(true);
    expect(mockDestination.writeTracks).toHaveBeenCalledTimes(1);

    const [writtenJobId, writtenTracks] = vi.mocked(mockDestination.writeTracks).mock.calls[0]!;
    expect(writtenJobId).toBe(result.job.id);
    expect(writtenTracks).toHaveLength(2);
    expect(writtenTracks[0]?.sourceId).toBe('101');
    expect(writtenTracks[0]?.title).toBe('First Song');
    expect(writtenTracks[0]?.durationMs).toBe(210000);
    expect(writtenTracks[1]?.sourceId).toBe('102');
    expect(writtenTracks[1]?.explicit).toBe(true);
  });

  // Test 3: Import progress is updated
  it('3. Import progress is updated', async () => {
    const progressSnapshots: ImportProgress[] = [];
    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
    });

    const result = await engine.importPlaylist(
      { playlistId: 'pl-progress', batchSize: 2 },
      {
        onProgress: (p) => progressSnapshots.push({ ...p }),
      }
    );

    expect(result.success).toBe(true);
    expect(progressSnapshots.length).toBeGreaterThan(0);

    // Initial snapshot
    expect(progressSnapshots[0]?.status).toBe('running');
    expect(progressSnapshots[0]?.processedTracks).toBe(0);

    // Final result progress
    expect(result.progress.status).toBe('completed');
    expect(result.progress.processedTracks).toBe(3);
    expect(result.progress.writtenTracks).toBe(3);
    expect(result.progress.currentBatch).toBe(2);
    expect(result.progress.totalBatches).toBe(2);
  });

  // Test 4: 10,000-track safety limit is enforced
  describe('4. The 10,000-track safety limit is enforced', () => {
    it('rejects caller request with limit > 10,000 with ImportLimitError', async () => {
      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      // Returning structured error mode
      const result = await engine.importPlaylist({
        playlistId: 'pl-large',
        limit: 10_001,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ImportLimitError);
      expect(result.error?.code).toBe('IMPORT_LIMIT_EXCEEDED');
      expect(result.error?.details).toMatchObject({
        requestedLimit: 10_001,
        maxAllowed: MAX_IMPORT_TRACKS,
      });
      expect(result.job.status).toBe('failed');

      // Throwing mode
      await expect(
        engine.importPlaylistOrThrow({
          playlistId: 'pl-large',
          limit: 15_000,
        })
      ).rejects.toThrow(ImportLimitError);
    });

    it('clamps incoming source tracks to MAX_IMPORT_TRACKS even if source returns more', async () => {
      // Create source returning more tracks than limit
      const oversizedTracks = Array.from({ length: 12 }, (_, i) =>
        createSampleTrack(`ov-${i}`)
      );

      mockSource.getTracks = vi.fn(async () => ({
        tracks: oversizedTracks,
        hasMore: false,
        total: oversizedTracks.length,
      }));

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      // Request limit of 5
      const result = await engine.importPlaylist({
        playlistId: 'pl-clamped',
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.progress.writtenTracks).toBe(5);
      expect(result.progress.processedTracks).toBe(5);
    });

    it('allows valid limit up to exactly 10,000', async () => {
      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({
        playlistId: 'pl-exact',
        limit: MAX_IMPORT_TRACKS,
      });

      expect(result.success).toBe(true);
      expect(result.job.requestedLimit).toBe(10_000);
    });
  });

  // Test 5: Batch size configuration works
  describe('5. Batch size configuration works', () => {
    it('splits tracks into custom configured batch sizes', async () => {
      const fiveTracks = Array.from({ length: 5 }, (_, i) => createSampleTrack(`b-${i}`));
      mockSource.getTracks = vi.fn(async () => ({
        tracks: fiveTracks,
        hasMore: false,
        total: 5,
      }));

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      // batchSize of 2 with 5 tracks -> batches of 2, 2, 1 (3 calls)
      const result = await engine.importPlaylist({
        playlistId: 'pl-batch',
        batchSize: 2,
      });

      expect(result.success).toBe(true);
      expect(mockDestination.writeTracks).toHaveBeenCalledTimes(3);

      const calls = vi.mocked(mockDestination.writeTracks).mock.calls;
      expect(calls[0]![1]).toHaveLength(2);
      expect(calls[1]![1]).toHaveLength(2);
      expect(calls[2]![1]).toHaveLength(1);
      expect(result.progress.totalBatches).toBe(3);
    });

    it('falls back to centralized DEFAULT_BATCH_SIZE when unspecified', async () => {
      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({
        playlistId: 'pl-default-batch',
      });

      expect(result.success).toBe(true);
      expect(result.job.batchSize).toBe(DEFAULT_BATCH_SIZE);
      expect(DEFAULT_BATCH_SIZE).toBe(100);
    });
  });

  // Test 6: Structured errors are returned/thrown correctly
  describe('6. Structured errors are returned/thrown correctly', () => {
    it('returns and throws ValidationError for invalid inputs', async () => {
      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      // Invalid empty playlist ID
      const result = await engine.importPlaylist({ playlistId: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.toJSON()).toHaveProperty('timestamp');

      // Throwing mode
      await expect(
        engine.importPlaylistOrThrow({ playlistId: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('returns and throws SourceError when MusicSource fails', async () => {
      mockSource.getPlaylist = vi.fn(async () => {
        throw new Error('Remote source timeout');
      });

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({ playlistId: 'pl-fail-src' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SourceError);
      expect(result.error?.code).toBe('SOURCE_ERROR');
      expect(result.error?.details).toMatchObject({
        sourceName: 'test-source',
        operation: 'getPlaylist',
      });

      await expect(
        engine.importPlaylistOrThrow({ playlistId: 'pl-fail-src' })
      ).rejects.toThrow(SourceError);
    });

    it('returns and throws DestinationError when MusicDestination fails', async () => {
      mockDestination.writeTracks = vi.fn(async () => {
        throw new Error('Database connection lost');
      });

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({ playlistId: 'pl-fail-dest' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(DestinationError);
      expect(result.error?.code).toBe('DESTINATION_ERROR');
      expect(result.error?.details).toMatchObject({
        destinationName: 'test-destination',
        operation: 'writeTracks',
      });

      await expect(
        engine.importPlaylistOrThrow({ playlistId: 'pl-fail-dest' })
      ).rejects.toThrow(DestinationError);
    });

    it('returns and throws ImportCancelledError when cancellation signal is triggered', async () => {
      const abortController = new AbortController();
      abortController.abort(); // already aborted

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({
        playlistId: 'pl-cancel',
        signal: abortController.signal,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ImportCancelledError);
      expect(result.error?.code).toBe('IMPORT_CANCELLED');
    });

    it('structured error toJSON returns machine-readable payload', () => {
      const error = new ValidationError('Bad request', { field: 'playlistId' });
      const payload = error.toJSON();

      expect(payload).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Bad request',
        details: { field: 'playlistId' },
        timestamp: expect.any(String),
      });
    });
  });

  // Test 7: An empty playlist is handled correctly
  it('7. An empty playlist is handled correctly', async () => {
    mockSource.getPlaylist = vi.fn(async () => createSamplePlaylist('pl-empty', 0));
    mockSource.getTracks = vi.fn(async () => ({
      tracks: [],
      hasMore: false,
      total: 0,
    }));

    const engine = new ImportEngine({
      source: mockSource,
      destination: mockDestination,
    });

    const result = await engine.importPlaylist({ playlistId: 'pl-empty' });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.progress.writtenTracks).toBe(0);
    expect(result.progress.processedTracks).toBe(0);
    expect(result.progress.totalBatches).toBe(0);

    // writeTracks shouldn't be called for 0 tracks
    expect(mockDestination.writeTracks).not.toHaveBeenCalled();
    // But transaction is committed successfully
    expect(mockDestination.commit).toHaveBeenCalledWith(result.job.id);
    expect(mockDestination.rollback).not.toHaveBeenCalled();
  });

  // Test 8: A destination failure does not silently produce a successful import
  describe('8. A destination failure does not silently produce a successful import', () => {
    it('rolls back and marks import as failed when writeTracks throws', async () => {
      mockDestination.writeTracks = vi.fn(async () => {
        throw new Error('Disk write error');
      });

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({ playlistId: 'pl-dest-fail' });

      // MUST NOT be successful
      expect(result.success).toBe(false);
      expect(result.job.status).toBe('failed');
      expect(result.progress.status).toBe('failed');
      expect(result.error).toBeInstanceOf(DestinationError);

      // Must attempt rollback
      expect(mockDestination.rollback).toHaveBeenCalledWith(
        result.job.id,
        expect.any(DestinationError)
      );

      // Must NEVER call commit
      expect(mockDestination.commit).not.toHaveBeenCalled();
    });

    it('rolls back and marks import as failed when commit throws', async () => {
      mockDestination.commit = vi.fn(async () => {
        throw new Error('Commit failed: transaction deadlock');
      });

      const engine = new ImportEngine({
        source: mockSource,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({ playlistId: 'pl-commit-fail' });

      expect(result.success).toBe(false);
      expect(result.job.status).toBe('failed');
      expect(result.error).toBeInstanceOf(DestinationError);
      expect(mockDestination.rollback).toHaveBeenCalledWith(
        result.job.id,
        expect.any(DestinationError)
      );
    });
  });
});
