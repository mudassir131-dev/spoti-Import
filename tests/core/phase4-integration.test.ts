import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportEngine,
  InMemoryMusicDestination,
  InMemoryCheckpointStore,
  MAX_IMPORT_TRACKS,
  ImportCancelledError,
  SourceError,
  DestinationError,
  type MusicSource,
  type MusicDestination,
  type ImportedTrack,
  type ImportedPlaylist,
  type SourceTrackPage,
} from '../../src/index.js';

function createMockTrack(id: string): ImportedTrack {
  return {
    source: 'mock-platform',
    sourceId: id,
    title: `Song ${id}`,
    artists: [{ name: `Artist ${id}`, sourceId: `art-${id}` }],
    album: {
      title: `Album ${id}`,
      sourceId: `alb-${id}`,
      releaseDate: '2025-01-01',
    },
    durationMs: 200000,
    isrc: `USRC99999${id.padStart(3, '0')}`,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
  };
}

describe('Phase 4 Integration Test Suite - Comprehensive 16-Scenario Verification', () => {
  let checkpointStore: InMemoryCheckpointStore;
  let destination: InMemoryMusicDestination;

  beforeEach(() => {
    checkpointStore = new InMemoryCheckpointStore();
    destination = new InMemoryMusicDestination('integration-sink');
  });

  // 1. Fresh 10,000-track import
  it('Scenario 1: Fresh 10,000-track import executes safely to completion', async () => {
    const mockSource: MusicSource = {
      name: 'large-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'large-source',
        sourceId: id,
        title: 'Full 10k Playlist',
        totalTracks: 10000,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 1; i <= 10000; i++) {
          yield createMockTrack(`trk-${i}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2000,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-10k-fresh',
      jobId: 'job-10k-fresh',
      batchSize: 2000,
    });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.progress.writtenTracks).toBe(10000);
    expect(result.isTruncated).toBe(false);

    const committed = destination.getCommittedTracks('job-10k-fresh');
    expect(committed.length).toBe(10000);
  });

  // 2. Failure halfway through
  it('Scenario 2: Failure halfway through checkpoints committed batches and stops', async () => {
    let batchCount = 0;
    const flakeyDestination = new InMemoryMusicDestination('flakey-halfway');
    const originalWrite = flakeyDestination.writeTracks.bind(flakeyDestination);

    flakeyDestination.writeTracks = vi.fn(async (jobId, tracks, signal, context) => {
      batchCount++;
      if (batchCount === 3) {
        throw new Error('Midway connection drop at batch 3');
      }
      return originalWrite(jobId, tracks, signal, context);
    });

    const mockSource: MusicSource = {
      name: 'stream-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'stream-source',
        sourceId: id,
        title: 'Halfway Playlist',
        totalTracks: 8,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 1; i <= 8; i++) {
          yield createMockTrack(`half-${i}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: flakeyDestination,
      checkpointStore,
      defaultBatchSize: 2,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-halfway',
      jobId: 'job-halfway',
      batchSize: 2,
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.error).toBeInstanceOf(DestinationError);

    // Batches 1 and 2 (4 tracks) were committed before batch 3 failed
    const committed = flakeyDestination.getCommittedTracks('job-halfway');
    expect(committed.length).toBe(4);
    expect(committed.map((t) => t.sourceId)).toEqual(['half-1', 'half-2', 'half-3', 'half-4']);

    const cp = await checkpointStore.load('job-halfway');
    expect(cp?.status).toBe('failed');
    expect(cp?.writtenTracks).toBe(4);
  });

  // 3. Resume after failure
  it('Scenario 3: Resume after failure continues from checkpoint without re-writing committed batches', async () => {
    // Checkpoint after batch 1 (2 tracks committed)
    await checkpointStore.save({
      importId: 'job-resume-after-fail',
      sourceName: 'mock-source',
      sourceReference: 'pl-fail-resume',
      processedTracks: 2,
      writtenTracks: 2,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 1,
      currentPage: 1,
      isTruncated: false,
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await destination.writeTracks(
      'job-resume-after-fail',
      [createMockTrack('rf-1'), createMockTrack('rf-2')],
      undefined,
      { batchId: 'job-resume-after-fail:batch:1', batchIndex: 1, trackCount: 2 }
    );
    await destination.commit('job-resume-after-fail');

    const mockSource: MusicSource = {
      name: 'mock-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'mock-source',
        sourceId: id,
        title: 'Resume Playlist',
        totalTracks: 5,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 1; i <= 5; i++) {
          yield createMockTrack(`rf-${i}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-fail-resume',
      jobId: 'job-resume-after-fail',
      batchSize: 2,
    });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.progress.writtenTracks).toBe(5);

    const committed = destination.getCommittedTracks('job-resume-after-fail');
    expect(committed.length).toBe(5);
    expect(committed.map((t) => t.sourceId)).toEqual(['rf-1', 'rf-2', 'rf-3', 'rf-4', 'rf-5']);
  });

  // 4. Application restart simulation
  it('Scenario 4: Application restart simulation preserves checkpoint and resumes successfully', async () => {
    const sharedCheckpointStore = new InMemoryCheckpointStore();
    const sharedDestination = new InMemoryMusicDestination('shared-persistent-sink');

    // Run 1: Interrupted at batch 1
    let failNow = true;
    const flakeyDest: MusicDestination = {
      name: sharedDestination.name,
      commit: (jobId) => sharedDestination.commit(jobId),
      rollback: (jobId, cause) => sharedDestination.rollback(jobId, cause),
      writeTracks: vi.fn(async (jobId, tracks, signal, context) => {
        if (context?.batchIndex === 2 && failNow) {
          failNow = false;
          throw new Error('Simulated process crash');
        }
        return sharedDestination.writeTracks(jobId, tracks, signal, context);
      }),
    };

    const mockSource: MusicSource = {
      name: 'restart-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'restart-source',
        sourceId: id,
        title: 'Restart Playlist',
        totalTracks: 4,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: [createMockTrack('rst-1'), createMockTrack('rst-2'), createMockTrack('rst-3'), createMockTrack('rst-4')],
        hasMore: false,
        total: 4,
      })),
    };

    const processInstance1 = new ImportEngine({
      source: mockSource,
      destination: flakeyDest,
      checkpointStore: sharedCheckpointStore,
      defaultBatchSize: 2,
    });

    const run1 = await processInstance1.importPlaylist({
      playlistId: 'pl-app-restart',
      jobId: 'job-app-restart',
      batchSize: 2,
    });
    expect(run1.success).toBe(false);

    // Simulate complete process restart: instantiate brand new ImportEngine referencing persisted store
    const processInstance2 = new ImportEngine({
      source: mockSource,
      destination: sharedDestination,
      checkpointStore: sharedCheckpointStore,
      defaultBatchSize: 2,
    });

    const run2 = await processInstance2.importPlaylist({
      playlistId: 'pl-app-restart',
      jobId: 'job-app-restart',
      batchSize: 2,
    });

    expect(run2.success).toBe(true);
    expect(run2.job.status).toBe('completed');
    expect(sharedDestination.getCommittedTracks('job-app-restart').length).toBe(4);
    expect(sharedDestination.getCommittedTracks('job-app-restart').map((t) => t.sourceId)).toEqual([
      'rst-1', 'rst-2', 'rst-3', 'rst-4',
    ]);
  });

  // 5. Duplicate execution
  it('Scenario 5: Duplicate execution with same jobId does not re-write committed batches', async () => {
    const mockSource: MusicSource = {
      name: 'dup-exec-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'dup-exec-source',
        sourceId: id,
        title: 'Dup Exec Playlist',
        totalTracks: 2,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: [createMockTrack('de-1'), createMockTrack('de-2')],
        hasMore: false,
        total: 2,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const firstRun = await engine.importPlaylist({
      playlistId: 'pl-dup-exec',
      jobId: 'job-dup-exec',
    });
    expect(firstRun.success).toBe(true);
    expect(destination.getCommittedTracks('job-dup-exec').length).toBe(2);

    // Immediate second call
    const secondRun = await engine.importPlaylist({
      playlistId: 'pl-dup-exec',
      jobId: 'job-dup-exec',
    });

    expect(secondRun.success).toBe(true);
    expect(secondRun.job.status).toBe('completed');
    // Destination tracks remain exactly 2, not 4
    expect(destination.getCommittedTracks('job-dup-exec').length).toBe(2);
  });

  // 6. Cancellation
  it('Scenario 6: Cancellation cleanly stops pipeline and leaves job in cancelled state', async () => {
    const controller = new AbortController();
    const tracks = [createMockTrack('c1'), createMockTrack('c2'), createMockTrack('c3'), createMockTrack('c4')];

    const originalWrite = destination.writeTracks.bind(destination);
    destination.writeTracks = vi.fn(async (jobId, bTracks, signal, context) => {
      const res = await originalWrite(jobId, bTracks, signal, context);
      if (context?.batchIndex === 1) {
        controller.abort();
      }
      return res;
    });

    const mockSource: MusicSource = {
      name: 'cancel-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'cancel-source',
        sourceId: id,
        title: 'Cancel Test',
        totalTracks: 4,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: 4,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-cancel',
      jobId: 'job-cancel',
      batchSize: 2,
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('cancelled');
    expect(result.error).toBeInstanceOf(ImportCancelledError);
    expect(destination.getCommittedTracks('job-cancel').length).toBe(2);
  });

  // 7. Destination failure
  it('Scenario 7: Destination failure aborts execution and marks job failed', async () => {
    const brokenDestination: InMemoryMusicDestination = new InMemoryMusicDestination('broken-dest');
    brokenDestination.writeTracks = vi.fn(async () => {
      throw new Error('Database locked');
    });

    const mockSource: MusicSource = {
      name: 'src',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'src',
        sourceId: id,
        title: 'Dest Failure Playlist',
        totalTracks: 1,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: [createMockTrack('1')],
        hasMore: false,
        total: 1,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination: brokenDestination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-dest-err',
      jobId: 'job-dest-err',
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.error).toBeInstanceOf(DestinationError);
  });

  // 8. Source failure
  it('Scenario 8: Source failure cleanly aborts before destination write', async () => {
    const mockSource: MusicSource = {
      name: 'broken-source',
      getPlaylist: vi.fn(async () => {
        throw new Error('External source rate limit 429');
      }),
      getTracks: vi.fn(),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-source-err',
      jobId: 'job-source-err',
    });

    expect(result.success).toBe(false);
    expect(result.job.status).toBe('failed');
    expect(result.error).toBeInstanceOf(SourceError);
    expect(destination.committedJobs.has('job-source-err')).toBe(false);
  });

  // 9. Empty playlist
  it('Scenario 9: Empty playlist completes successfully with zero written tracks', async () => {
    const mockSource: MusicSource = {
      name: 'empty-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'empty-source',
        sourceId: id,
        title: 'Empty Playlist',
        totalTracks: 0,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: [],
        hasMore: false,
        total: 0,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-empty',
      jobId: 'job-empty',
    });

    expect(result.success).toBe(true);
    expect(result.job.status).toBe('completed');
    expect(result.progress.writtenTracks).toBe(0);
    expect(destination.getCommittedTracks('job-empty').length).toBe(0);
  });

  // 10. Playlist containing duplicate occurrences (deduplicate=false)
  it('Scenario 10: Playlist containing duplicates preserves all occurrences when deduplicate=false', async () => {
    const tracksWithDuplicates = [
      createMockTrack('track-X'),
      createMockTrack('track-Y'),
      createMockTrack('track-X'),
      createMockTrack('track-Z'),
      createMockTrack('track-X'),
    ];

    const mockSource: MusicSource = {
      name: 'dup-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'dup-source',
        sourceId: id,
        title: 'Duplicates Preserved',
        totalTracks: 5,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: tracksWithDuplicates,
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
      playlistId: 'pl-dups-preserved',
      jobId: 'job-dups-preserved',
      deduplicate: false,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(5);
    const committed = destination.getCommittedTracks('job-dups-preserved');
    expect(committed.map((t) => t.sourceId)).toEqual(['track-X', 'track-Y', 'track-X', 'track-Z', 'track-X']);
  });

  // 11. deduplicate=true
  it('Scenario 11: deduplicate=true suppresses duplicate tracks by sourceId', async () => {
    const tracksWithDuplicates = [
      createMockTrack('track-X'),
      createMockTrack('track-Y'),
      createMockTrack('track-X'),
      createMockTrack('track-Z'),
      createMockTrack('track-X'),
    ];

    const mockSource: MusicSource = {
      name: 'dup-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'dup-source',
        sourceId: id,
        title: 'Duplicates Filtered',
        totalTracks: 5,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks: tracksWithDuplicates,
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
      playlistId: 'pl-dups-filtered',
      jobId: 'job-dups-filtered',
      deduplicate: true,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(3);
    expect(result.progress.skippedTracks).toBe(2);
    const committed = destination.getCommittedTracks('job-dups-filtered');
    expect(committed.map((t) => t.sourceId)).toEqual(['track-X', 'track-Y', 'track-Z']);
  });

  // 12. Playlist larger than 10,000
  it('Scenario 12: Playlist larger than 10,000 tracks is capped at MAX_IMPORT_TRACKS and marked isTruncated', async () => {
    const mockSource: MusicSource = {
      name: 'huge-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'huge-source',
        sourceId: id,
        title: '10010 Tracks Playlist',
        totalTracks: 10010,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 1; i <= 10010; i++) {
          yield createMockTrack(`h-${i}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2000,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-10010',
      jobId: 'job-10010',
      batchSize: 2000,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(MAX_IMPORT_TRACKS);
    expect(result.isTruncated).toBe(true);
    expect(result.job.isTruncated).toBe(true);
    expect(destination.getCommittedTracks('job-10010').length).toBe(MAX_IMPORT_TRACKS);
  });

  // 13. Exactly 10,000
  it('Scenario 13: Exactly 10,000 tracks imported cleanly with isTruncated=false', async () => {
    const mockSource: MusicSource = {
      name: 'exact-10k-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'exact-10k-source',
        sourceId: id,
        title: 'Exactly 10000 Tracks',
        totalTracks: 10000,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 1; i <= 10000; i++) {
          yield createMockTrack(`ex-${i}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2500,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-exact-10k',
      jobId: 'job-exact-10k',
      batchSize: 2500,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(10000);
    expect(result.isTruncated).toBe(false);
    expect(destination.getCommittedTracks('job-exact-10k').length).toBe(10000);
  });

  // 14. Fewer than 10,000
  it('Scenario 14: Fewer than 10,000 tracks (e.g. 250 tracks) completes in batches without truncation', async () => {
    const count = 250;
    const tracks = Array.from({ length: count }, (_, i) => createMockTrack(`small-${i + 1}`));

    const mockSource: MusicSource = {
      name: 'small-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'small-source',
        sourceId: id,
        title: 'Small 250 Playlist',
        totalTracks: count,
      })),
      getTracks: vi.fn(async (): Promise<SourceTrackPage> => ({
        tracks,
        hasMore: false,
        total: count,
      })),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 100,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-250',
      jobId: 'job-250',
      batchSize: 100,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(250);
    expect(result.isTruncated).toBe(false);
    expect(destination.getCommittedTracks('job-250').length).toBe(250);
  });

  // 15. Resume after truncation
  it('Scenario 15: Resumed large playlist preserves truncation ceiling and isTruncated status', async () => {
    await checkpointStore.save({
      importId: 'job-trunc-resume',
      sourceName: 'trunc-source',
      sourceReference: 'pl-trunc-resume',
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
      name: 'trunc-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'trunc-source',
        sourceId: id,
        title: 'Truncated Playlist',
        totalTracks: 12000,
      })),
      getTracks: vi.fn(),
      getTrackStream: vi.fn(async function* () {
        for (let i = 1; i <= 12000; i++) {
          yield createMockTrack(`tr-${i}`);
        }
      }),
    };

    const engine = new ImportEngine({
      source: mockSource,
      destination,
      checkpointStore,
      defaultBatchSize: 2000,
    });

    const result = await engine.importPlaylist({
      playlistId: 'pl-trunc-resume',
      jobId: 'job-trunc-resume',
      batchSize: 2000,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(MAX_IMPORT_TRACKS);
    expect(result.isTruncated).toBe(true);
    expect(result.job.isTruncated).toBe(true);
  });

  // 16. Completed import cannot accidentally duplicate itself
  it('Scenario 16: Completed import cannot accidentally duplicate itself on repeated execution', async () => {
    const tracks = [createMockTrack('fin-1'), createMockTrack('fin-2')];

    const mockSource: MusicSource = {
      name: 'fin-source',
      getPlaylist: vi.fn(async (id: string): Promise<ImportedPlaylist> => ({
        source: 'fin-source',
        sourceId: id,
        title: 'Finished Playlist',
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

    const run1 = await engine.importPlaylist({
      playlistId: 'pl-finished',
      jobId: 'job-finished',
    });
    expect(run1.success).toBe(true);
    expect(destination.getCommittedTracks('job-finished').length).toBe(2);

    // Run 2: same import
    const run2 = await engine.importPlaylist({
      playlistId: 'pl-finished',
      jobId: 'job-finished',
    });
    expect(run2.success).toBe(true);
    expect(destination.getCommittedTracks('job-finished').length).toBe(2);

    // Run 3: same import
    const run3 = await engine.importPlaylist({
      playlistId: 'pl-finished',
      jobId: 'job-finished',
    });
    expect(run3.success).toBe(true);
    expect(destination.getCommittedTracks('job-finished').length).toBe(2);
  });
});
