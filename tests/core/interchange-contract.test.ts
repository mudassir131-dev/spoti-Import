import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CURRENT_SCHEMA_VERSION,
  UniversalImportPayloadSchema,
  validateUniversalImportPayload,
  JsonMusicDestination,
  ImportEngine,
  InMemoryMusicSource,
  type ImportedTrack,
  type ImportedPlaylist,
} from '../../src/index.js';

describe('Phase 6 PR 1 - Import Interchange Contract', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../fixtures/data/universal-interchange-v1-fixture.json'
  );

  it('validates the checked-in canonical v1 fixture against UniversalImportPayloadSchema', () => {
    const rawContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = JSON.parse(rawContent);

    const validated = validateUniversalImportPayload(parsed);
    expect(validated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(validated.importId).toBe('import_test_fixture_001');
    expect(validated.source).toBe('spotify');
    expect(validated.status).toBe('completed');
    expect(validated.isTruncated).toBe(false);
    expect(validated.tracks).toHaveLength(3);
    expect(validated.playlist).toBeDefined();
    expect(validated.playlist?.name).toBe('Indie Classics');
    expect(validated.exportedAt).toBe('2026-10-10T12:00:02.500Z');
  });

  it('preserves playlist ordering and distinguishes track identity from occurrence identity', () => {
    const rawContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = JSON.parse(rawContent);
    const validated = validateUniversalImportPayload(parsed);

    // Positions must be strictly sequential (0, 1, 2)
    expect(validated.tracks[0]!.position).toBe(0);
    expect(validated.tracks[1]!.position).toBe(1);
    expect(validated.tracks[2]!.position).toBe(2);

    // Track 0 and Track 2 have the same track identity (sourceId)
    expect(validated.tracks[0]!.sourceId).toBe('track_abc_123');
    expect(validated.tracks[2]!.sourceId).toBe('track_abc_123');

    // But they have distinct playlist occurrence identities
    expect(validated.tracks[0]!.occurrenceId).toBe('import_test_fixture_001:0');
    expect(validated.tracks[2]!.occurrenceId).toBe('import_test_fixture_001:2');
    expect(validated.tracks[0]!.occurrenceId).not.toBe(validated.tracks[2]!.occurrenceId);
  });

  it('fails explicitly for unsupported schema versions', () => {
    const rawContent = fs.readFileSync(fixturePath, 'utf-8');
    const payloadV2 = { ...JSON.parse(rawContent), schemaVersion: 2 };

    expect(() => validateUniversalImportPayload(payloadV2)).toThrow(
      /Unsupported schemaVersion: expected 1, received 2/
    );

    const payloadV999 = { ...JSON.parse(rawContent), schemaVersion: 999 };
    expect(() => validateUniversalImportPayload(payloadV999)).toThrow(
      /Unsupported schemaVersion: expected 1, received 999/
    );
  });

  it('rejects payloads missing mandatory fields', () => {
    const rawContent = fs.readFileSync(fixturePath, 'utf-8');
    const base = JSON.parse(rawContent);

    // Missing importId
    const missingImportId = { ...base };
    delete missingImportId.importId;
    expect(() => UniversalImportPayloadSchema.parse(missingImportId)).toThrow();

    // Missing source
    const missingSource = { ...base };
    delete missingSource.source;
    expect(() => UniversalImportPayloadSchema.parse(missingSource)).toThrow();

    // Missing tracks
    const missingTracks = { ...base };
    delete missingTracks.tracks;
    expect(() => UniversalImportPayloadSchema.parse(missingTracks)).toThrow();

    // Missing exportedAt
    const missingExportedAt = { ...base };
    delete missingExportedAt.exportedAt;
    expect(() => UniversalImportPayloadSchema.parse(missingExportedAt)).toThrow();
  });

  it('allows optional fields to be absent without failure', () => {
    const minimalPayload = {
      schemaVersion: 1,
      importId: 'min-import-001',
      source: 'spotify',
      exportedAt: new Date().toISOString(),
      tracks: [
        {
          occurrenceId: 'occ-1',
          position: 0,
          source: 'spotify',
          sourceId: 'track-1',
          title: 'Minimal Song',
          artists: [{ name: 'Solo Artist' }],
        },
      ],
    };

    const validated = validateUniversalImportPayload(minimalPayload);
    expect(validated.playlist).toBeUndefined();
    expect(validated.metadata).toBeUndefined();
    expect(validated.tracks[0]!.album).toBeUndefined();
    expect(validated.tracks[0]!.isrc).toBeUndefined();
    expect(validated.tracks[0]!.durationMs).toBeUndefined();
  });

  it('validates that JsonMusicDestination produces output conforming to the interchange schema', async () => {
    const destination = new JsonMusicDestination({ pretty: true });

    const tracks: ImportedTrack[] = [
      {
        source: 'spotify',
        sourceId: 'sp_101',
        title: 'Song Alpha',
        artists: [{ name: 'Artist One', sourceId: 'art_1' }],
        album: { title: 'Album One', sourceId: 'alb_1' },
        durationMs: 180000,
        isrc: 'US1234567890',
      },
      {
        source: 'spotify',
        sourceId: 'sp_102',
        title: 'Song Beta',
        artists: [{ name: 'Artist Two' }],
      },
      {
        source: 'spotify',
        sourceId: 'sp_101', // Repeated track in playlist
        title: 'Song Alpha',
        artists: [{ name: 'Artist One', sourceId: 'art_1' }],
      },
    ];

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_interchange_test',
      title: 'Interchange Test Playlist',
      description: 'Verifying compatibility',
      owner: 'test_curator',
      totalTracks: 3,
    };

    const source = new InMemoryMusicSource('spotify', {
      pl_interchange_test: { playlist, tracks },
    });

    const engine = new ImportEngine({ source, destination });
    const result = await engine.importPlaylist({
      playlistId: 'pl_interchange_test',
      jobId: 'job_interchange_001',
    });

    expect(result.success).toBe(true);

    const jsonString = destination.getJsonString('job_interchange_001');
    const parsed = JSON.parse(jsonString);

    const validated = validateUniversalImportPayload(parsed);
    expect(validated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(validated.importId).toBe('job_interchange_001');
    expect(validated.source).toBe('spotify');
    expect(validated.status).toBe('completed');
    expect(validated.isTruncated).toBe(false);
    expect(validated.tracks).toHaveLength(3);

    // Verify ordering and distinct occurrence IDs
    expect(validated.tracks[0]!.position).toBe(0);
    expect(validated.tracks[1]!.position).toBe(1);
    expect(validated.tracks[2]!.position).toBe(2);

    expect(validated.tracks[0]!.sourceId).toBe('sp_101');
    expect(validated.tracks[2]!.sourceId).toBe('sp_101');
    expect(validated.tracks[0]!.occurrenceId).toBe('occ_0');
    expect(validated.tracks[2]!.occurrenceId).toBe('occ_2');
    expect(validated.tracks[0]!.occurrenceId).not.toBe(validated.tracks[2]!.occurrenceId);
  });
});
