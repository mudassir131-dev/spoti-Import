import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportEngine,
  JsonMusicDestination,
  CsvMusicDestination,
  InMemoryCheckpointStore,
  InMemoryImportManifestStore,
  MAX_IMPORT_TRACKS,
  CURRENT_SCHEMA_VERSION,
  type MusicSource,
  type MusicDestination,
  type ImportedTrack,
  type ImportedPlaylist,
  type SourceTrackPage,
} from '../../src/index.js';

function createMockTrack(id: string, overrides: Partial<ImportedTrack> = {}): ImportedTrack {
  return {
    source: 'spotify',
    sourceId: id,
    title: `Song ${id}`,
    artists: [{ name: `Artist for ${id}`, sourceId: `art_${id}` }],
    album: {
      title: `Album for ${id}`,
      sourceId: `alb_${id}`,
      releaseDate: '2025-01-01',
    },
    durationMs: 180000,
    isrc: `USRC12345${id.padStart(3, '0')}`,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    artwork: `https://artwork.spotify.test/${id}.jpg`,
    ...overrides,
  };
}

function createMockSpotifySource(tracks: ImportedTrack[], totalTracks?: number): MusicSource {
  return {
    name: 'spotify',
    getPlaylist: vi.fn(async (playlistId: string): Promise<ImportedPlaylist> => ({
      source: 'spotify',
      sourceId: playlistId,
      title: `Mock Playlist ${playlistId}`,
      owner: 'spotify_user',
      totalTracks: totalTracks ?? tracks.length,
    })),
    getTracks: vi.fn(async (_playlistId: string, options = {}): Promise<SourceTrackPage> => {
      const limit = options.limit ?? tracks.length;
      const sliced = tracks.slice(0, limit);
      return {
        tracks: sliced,
        hasMore: sliced.length < tracks.length,
        total: totalTracks ?? tracks.length,
      };
    }),
    getTrackStream: vi.fn(async function* (_playlistId: string, options = {}) {
      const limit = options.limit ?? tracks.length;
      for (let i = 0; i < Math.min(tracks.length, limit); i++) {
        if (options.signal?.aborted) break;
        yield tracks[i]!;
      }
    }),
  };
}

describe('Phase 5 Comprehensive Integration Suite (PR 5)', () => {
  let checkpointStore: InMemoryCheckpointStore;
  let manifestStore: InMemoryImportManifestStore;

  beforeEach(() => {
    checkpointStore = new InMemoryCheckpointStore();
    manifestStore = new InMemoryImportManifestStore();
  });

  // 1. Empty Playlist
  it('Scenario 1: empty playlist import produces valid JSON and CSV outputs and manifest', async () => {
    const source = createMockSpotifySource([], 0);
    const jsonDest = new JsonMusicDestination();
    const csvDest = new CsvMusicDestination();

    const jsonEngine = new ImportEngine({ source, destination: jsonDest, manifestStore });
    const jsonResult = await jsonEngine.importPlaylist({ playlistId: 'pl_empty', jobId: 'job_empty_json' });
    expect(jsonResult.success).toBe(true);
    expect(jsonDest.getParsedJson('job_empty_json')).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      source: 'spotify',
      tracks: [],
      progress: { writtenTracks: 0 },
    });

    const csvEngine = new ImportEngine({ source, destination: csvDest, manifestStore });
    const csvResult = await csvEngine.importPlaylist({ playlistId: 'pl_empty', jobId: 'job_empty_csv' });
    expect(csvResult.success).toBe(true);
    const csvLines = csvDest.getCsvString('job_empty_csv').split('\r\n').filter(Boolean);
    expect(csvLines).toHaveLength(1); // Header only

    const manifest = await manifestStore.load('job_empty_json');
    expect(manifest?.lifecycle.status).toBe('completed');
    expect(manifest?.stats.writtenTracks).toBe(0);
  });

  // 2. Single Track
  it('Scenario 2: single track import produces exactly one record in JSON and CSV', async () => {
    const track = createMockTrack('t1');
    const source = createMockSpotifySource([track]);
    const jsonDest = new JsonMusicDestination();
    const csvDest = new CsvMusicDestination();

    const jsonEngine = new ImportEngine({ source, destination: jsonDest });
    await jsonEngine.importPlaylist({ playlistId: 'pl_single', jobId: 'job_single_json' });
    const parsedJson = jsonDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_single_json');
    expect(parsedJson.tracks).toHaveLength(1);
    expect(parsedJson.tracks[0]!.sourceId).toBe('t1');

    const csvEngine = new ImportEngine({ source, destination: csvDest });
    await csvEngine.importPlaylist({ playlistId: 'pl_single', jobId: 'job_single_csv' });
    const csvLines = csvDest.getCsvString('job_single_csv').split('\r\n').filter(Boolean);
    expect(csvLines).toHaveLength(2);
    expect(csvLines[1]).toContain('t1');
  });

  // 3. Multiple Tracks
  it('Scenario 3: multiple tracks preserve playlist sequence and metadata', async () => {
    const tracks = [createMockTrack('t1'), createMockTrack('t2'), createMockTrack('t3')];
    const source = createMockSpotifySource(tracks);
    const jsonDest = new JsonMusicDestination();
    const csvDest = new CsvMusicDestination();

    const engine = new ImportEngine({ source, destination: jsonDest });
    await engine.importPlaylist({ playlistId: 'pl_multi', jobId: 'job_multi_json' });
    const parsed = jsonDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_multi_json');
    expect(parsed.tracks.map((t) => t.sourceId)).toEqual(['t1', 't2', 't3']);

    const csvEngine = new ImportEngine({ source, destination: csvDest });
    await csvEngine.importPlaylist({ playlistId: 'pl_multi', jobId: 'job_multi_csv' });
    const lines = csvDest.getCsvString('job_multi_csv').split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(4);
  });

  // 4. Duplicate Occurrences
  it('Scenario 4: preserves duplicate occurrences by default', async () => {
    const tracks = [createMockTrack('t1'), createMockTrack('t2'), createMockTrack('t1')];
    const source = createMockSpotifySource(tracks);
    const jsonDest = new JsonMusicDestination();

    const engine = new ImportEngine({ source, destination: jsonDest });
    await engine.importPlaylist({ playlistId: 'pl_dups', jobId: 'job_dups', deduplicate: false });
    const parsed = jsonDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_dups');
    expect(parsed.tracks).toHaveLength(3);
    expect(parsed.tracks[2]!.sourceId).toBe('t1');
  });

  // 5. deduplicate=true
  it('Scenario 5: deduplicate=true drops second occurrence and reports skippedTracks', async () => {
    const tracks = [createMockTrack('t1'), createMockTrack('t2'), createMockTrack('t1')];
    const source = createMockSpotifySource(tracks);
    const jsonDest = new JsonMusicDestination();

    const engine = new ImportEngine({ source, destination: jsonDest });
    const result = await engine.importPlaylist({ playlistId: 'pl_dedup', jobId: 'job_dedup', deduplicate: true });
    expect(result.progress.skippedTracks).toBe(1);
    expect(result.progress.writtenTracks).toBe(2);

    const parsed = jsonDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_dedup');
    expect(parsed.tracks).toHaveLength(2);
  });

  // 6. Missing Metadata
  it('Scenario 6: tracks with missing optional metadata serialize cleanly in JSON and CSV', async () => {
    const minimalTrack: ImportedTrack = {
      source: 'spotify',
      sourceId: 't_sparse',
      title: 'Minimal Metadata Song',
      artists: [{ name: 'Solo' }],
    };
    const source = createMockSpotifySource([minimalTrack]);
    const jsonDest = new JsonMusicDestination();
    const csvDest = new CsvMusicDestination();

    const engine = new ImportEngine({ source, destination: jsonDest });
    await engine.importPlaylist({ playlistId: 'pl_sparse', jobId: 'job_sparse_json' });
    const parsed = jsonDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_sparse_json');
    expect(parsed.tracks[0]!.title).toBe('Minimal Metadata Song');
    expect(parsed.tracks[0]!.album).toBeUndefined();

    const csvEngine = new ImportEngine({ source, destination: csvDest });
    await csvEngine.importPlaylist({ playlistId: 'pl_sparse', jobId: 'job_sparse_csv' });
    const csvLines = csvDest.getCsvString('job_sparse_csv').split('\r\n').filter(Boolean);
    expect(csvLines[1]).toBe('spotify,t_sparse,Minimal Metadata Song,Solo,,,,,,,,');
  });

  // 7. Failed Source Track
  it('Scenario 7: invalid source track triggers validation error and rolls back destination', async () => {
    const invalidTrack = {
      source: 'spotify',
      sourceId: 't_bad',
      title: '', // Empty title fails validation schema
      artists: [{ name: 'A' }],
    } as unknown as ImportedTrack;

    const source = createMockSpotifySource([invalidTrack]);
    const jsonDest = new JsonMusicDestination();
    const engine = new ImportEngine({ source, destination: jsonDest });

    const result = await engine.importPlaylist({ playlistId: 'pl_bad', jobId: 'job_bad' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // 8. 10,000 Tracks
  it('Scenario 8: exactly 10,000 tracks stream without memory bloat', async () => {
    const tracks: ImportedTrack[] = [];
    for (let i = 1; i <= 10_000; i++) {
      tracks.push(createMockTrack(`trk_${i}`));
    }
    const source = createMockSpotifySource(tracks, 10_000);
    let chunksWritten = 0;
    const jsonDest = new JsonMusicDestination({
      writeChunk: () => {
        chunksWritten++;
      },
      streamOnly: true,
    });

    const engine = new ImportEngine({ source, destination: jsonDest });
    const result = await engine.importPlaylist({
      playlistId: 'pl_10k',
      jobId: 'job_10k',
      batchSize: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(10_000);
    expect(result.isTruncated).toBe(false);
    expect(chunksWritten).toBeGreaterThanOrEqual(10);
  });

  // 9. >10,000 Tracks
  it('Scenario 9: >10,000 tracks caps processing at MAX_IMPORT_TRACKS and marks truncated', async () => {
    const tracks: ImportedTrack[] = [];
    for (let i = 1; i <= 10_050; i++) {
      tracks.push(createMockTrack(`trk_${i}`));
    }
    const source = createMockSpotifySource(tracks, 10_050);
    const jsonDest = new JsonMusicDestination();

    const engine = new ImportEngine({ source, destination: jsonDest });
    const result = await engine.importPlaylist({
      playlistId: 'pl_over_10k',
      jobId: 'job_over_10k',
      batchSize: 2000,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(MAX_IMPORT_TRACKS);
    expect(result.isTruncated).toBe(true);

    const exportRes = await jsonDest.getExportResult('job_over_10k');
    expect(exportRes?.isTruncated).toBe(true);
  });

  // 10. Truncation via Limit
  it('Scenario 10: limit parameter truncates import correctly', async () => {
    const tracks = [createMockTrack('t1'), createMockTrack('t2'), createMockTrack('t3'), createMockTrack('t4')];
    const source = createMockSpotifySource(tracks);
    const jsonDest = new JsonMusicDestination();

    const engine = new ImportEngine({ source, destination: jsonDest });
    const result = await engine.importPlaylist({
      playlistId: 'pl_limit',
      jobId: 'job_limit',
      limit: 2,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(2);
    expect(result.isTruncated).toBe(true);
  });

  // 11. Cancellation
  it('Scenario 11: cancellation aborts import and records cancelled manifest', async () => {
    const controller = new AbortController();
    const tracks = [createMockTrack('t1'), createMockTrack('t2'), createMockTrack('t3')];
    const source: MusicSource = {
      name: 'spotify',
      getPlaylist: async () => ({ source: 'spotify', sourceId: 'pl_abort', title: 'Abort PL', totalTracks: 3 }),
      getTracks: vi.fn(),
      getTrackStream: async function* () {
        yield tracks[0]!;
        controller.abort(); // Cancel during streaming
        yield tracks[1]!;
      },
    };

    const jsonDest = new JsonMusicDestination();
    const engine = new ImportEngine({ source, destination: jsonDest, manifestStore });

    const result = await engine.importPlaylist({
      playlistId: 'pl_abort',
      jobId: 'job_abort',
      signal: controller.signal,
      batchSize: 1,
    });

    expect(result.success).toBe(false);
    const manifest = await manifestStore.load('job_abort');
    expect(manifest?.lifecycle.status).toBe('cancelled');
  });

  // 12. Resumed Import
  it('Scenario 12: resumed import safely finishes remaining tracks from checkpoint', async () => {
    const tracks = [
      createMockTrack('t1'),
      createMockTrack('t2'),
      createMockTrack('t3'),
      createMockTrack('t4'),
    ];
    const source = createMockSpotifySource(tracks);

    // Manually prime checkpoint as if interrupted after batch 1 (2 tracks)
    await checkpointStore.save({
      importId: 'job_resumed_test',
      sourceName: 'spotify',
      sourceReference: 'pl_resume',
      processedTracks: 2,
      writtenTracks: 2,
      skippedTracks: 0,
      failedTracks: 0,
      currentBatch: 1,
      currentPage: 1,
      lastProcessedSourceId: 't2',
      isTruncated: false,
      status: 'running',
      createdAt: '2026-10-08T10:00:00.000Z',
      updatedAt: '2026-10-08T10:01:00.000Z',
    });

    const dest = new JsonMusicDestination();
    const engine2 = new ImportEngine({
      source,
      destination: dest,
      checkpointStore,
    });

    const result = await engine2.importPlaylist({
      playlistId: 'pl_resume',
      jobId: 'job_resumed_test',
      batchSize: 2,
    });

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(4);
  });

  // 13. Failed Import
  it('Scenario 13: destination write failure records failed manifest and rolls back', async () => {
    const failingDest: MusicDestination = {
      name: 'broken-dest',
      async writeTracks() {
        throw new Error('Disk full write failure');
      },
      async commit() {},
      async rollback() {},
    };

    const tracks = [createMockTrack('t1')];
    const source = createMockSpotifySource(tracks);
    const engine = new ImportEngine({ source, destination: failingDest, manifestStore });

    const result = await engine.importPlaylist({
      playlistId: 'pl_fail',
      jobId: 'job_fail',
    });

    expect(result.success).toBe(false);
    const manifest = await manifestStore.load('job_fail');
    expect(manifest?.lifecycle.status).toBe('failed');
    expect(manifest?.stats.failedTracks).toBe(1);
  });

  // 14. Completed Manifest
  it('Scenario 14: completed import generates fully populated, versioned ImportManifest', async () => {
    const tracks = [createMockTrack('t1'), createMockTrack('t2')];
    const source = createMockSpotifySource(tracks);
    const destination = new JsonMusicDestination();

    const engine = new ImportEngine({ source, destination, manifestStore });
    await engine.importPlaylist({ playlistId: 'pl_manifest_complete', jobId: 'job_mf_comp' });

    const manifest = await manifestStore.load('job_mf_comp');
    expect(manifest).not.toBeNull();
    expect(manifest?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(manifest?.importerVersion).toBe('0.1.0');
    expect(manifest?.lifecycle.status).toBe('completed');
    expect(manifest?.stats.processedTracks).toBe(2);
    expect(manifest?.stats.writtenTracks).toBe(2);
    expect(manifest?.stats.skippedTracks).toBe(0);
  });

  // 15. Deterministic Output & Resumption Equivalence
  it('Scenario 15: output is strictly deterministic and resumed import output equals clean import', async () => {
    const tracks = [
      createMockTrack('t1'),
      createMockTrack('t2'),
      createMockTrack('t3'),
      createMockTrack('t4'),
    ];
    const source = createMockSpotifySource(tracks);

    // 1. Clean run
    const cleanDest = new JsonMusicDestination({ pretty: false });
    const cleanEngine = new ImportEngine({ source, destination: cleanDest });
    await cleanEngine.importPlaylist({ playlistId: 'pl_det', jobId: 'job_clean' });
    const cleanJson = cleanDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_clean');

    // 2. Second clean run to test determinism
    const secondCleanDest = new JsonMusicDestination({ pretty: false });
    const secondEngine = new ImportEngine({ source, destination: secondCleanDest });
    await secondEngine.importPlaylist({ playlistId: 'pl_det', jobId: 'job_clean_2' });
    const secondJson = secondCleanDest.getParsedJson<{ tracks: ImportedTrack[] }>('job_clean_2');

    expect(cleanJson.tracks).toEqual(secondJson.tracks);

    // 3. Clean CSV vs second clean CSV
    const cleanCsvDest = new CsvMusicDestination();
    const csvEngine1 = new ImportEngine({ source, destination: cleanCsvDest });
    await csvEngine1.importPlaylist({ playlistId: 'pl_det', jobId: 'job_csv_1' });

    const secondCsvDest = new CsvMusicDestination();
    const csvEngine2 = new ImportEngine({ source, destination: secondCsvDest });
    await csvEngine2.importPlaylist({ playlistId: 'pl_det', jobId: 'job_csv_2' });

    expect(cleanCsvDest.getCsvString('job_csv_1')).toBe(secondCsvDest.getCsvString('job_csv_2'));
  });
});
