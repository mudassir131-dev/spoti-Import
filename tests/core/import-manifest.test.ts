import { describe, it, expect } from 'vitest';
import {
  ImportManifestSchema,
  CURRENT_SCHEMA_VERSION,
  InMemoryImportManifestStore,
  ImportEngine,
  InMemoryMusicSource,
  InMemoryMusicDestination,
  type ImportManifest,
  type ImportedTrack,
  type ImportedPlaylist,
} from '../../src/index.js';

describe('Phase 5 Import Manifest (PR 4)', () => {
  const sampleManifest: ImportManifest = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    importerVersion: '0.1.0',
    importId: 'manifest-test-1',
    source: {
      name: 'spotify',
      playlistId: 'pl_rock',
      title: 'Rock Classics',
      owner: 'rock_god',
      totalTracks: 50,
    },
    destination: {
      name: 'json-exporter',
      format: 'json',
    },
    lifecycle: {
      status: 'completed',
      createdAt: '2026-10-08T10:00:00.000Z',
      updatedAt: '2026-10-08T10:05:00.000Z',
      completedAt: '2026-10-08T10:05:00.000Z',
    },
    stats: {
      processedTracks: 50,
      writtenTracks: 50,
      skippedTracks: 0,
      failedTracks: 0,
      isTruncated: false,
      batchCount: 1,
    },
  };

  describe('ImportManifestSchema Validation', () => {
    it('successfully parses a compliant ImportManifest', () => {
      const parsed = ImportManifestSchema.parse(sampleManifest);
      expect(parsed).toEqual(sampleManifest);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.importerVersion).toBe('0.1.0');
    });

    it('rejects manifest with missing required fields or invalid lifecycle status', () => {
      expect(() =>
        ImportManifestSchema.parse({
          ...sampleManifest,
          importId: '',
        })
      ).toThrow();

      expect(() =>
        ImportManifestSchema.parse({
          ...sampleManifest,
          lifecycle: {
            ...sampleManifest.lifecycle,
            status: 'unknown_status' as any,
          },
        })
      ).toThrow();


      expect(() =>
        ImportManifestSchema.parse({
          ...sampleManifest,
          stats: {
            ...sampleManifest.stats,
            processedTracks: -5,
          },
        })
      ).toThrow();
    });
  });

  describe('InMemoryImportManifestStore', () => {
    it('saves and loads manifests correctly with isolation from mutation', async () => {
      const store = new InMemoryImportManifestStore();
      await store.save(sampleManifest);

      const loaded = await store.load('manifest-test-1');
      expect(loaded).toEqual(sampleManifest);

      // Mutate loaded object to verify isolation
      if (loaded) {
        loaded.stats.processedTracks = 999;
      }

      const reloaded = await store.load('manifest-test-1');
      expect(reloaded?.stats.processedTracks).toBe(50);
    });

    it('lists all saved manifests and supports deletion', async () => {
      const store = new InMemoryImportManifestStore();
      await store.save(sampleManifest);
      await store.save({
        ...sampleManifest,
        importId: 'manifest-test-2',
      });

      const list = await store.list();
      expect(list).toHaveLength(2);

      await store.delete('manifest-test-1');
      const listAfter = await store.list();
      expect(listAfter).toHaveLength(1);
      expect(listAfter[0]!.importId).toBe('manifest-test-2');
    });
  });

  describe('ImportEngine Integration with ManifestStore', () => {
    it('records completed lifecycle and stats upon successful import', async () => {
      const manifestStore = new InMemoryImportManifestStore();
      const destination = new InMemoryMusicDestination();

      const track: ImportedTrack = {
        source: 'spotify',
        sourceId: 'trk_alpha',
        title: 'Alpha Song',
        artists: [{ name: 'Band Alpha' }],
      };

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_mf_test',
        title: 'Manifest Test Playlist',
        owner: 'curator_alpha',
        totalTracks: 1,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_mf_test: { playlist, tracks: [track] },
      });

      const engine = new ImportEngine({
        source,
        destination,
        manifestStore,
      });

      const result = await engine.importPlaylist({
        playlistId: 'pl_mf_test',
        jobId: 'mf-job-success',
      });

      expect(result.success).toBe(true);

      const manifest = await manifestStore.load('mf-job-success');
      expect(manifest).not.toBeNull();
      expect(manifest?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(manifest?.importerVersion).toBe('0.1.0');
      expect(manifest?.source.name).toBe('in-memory-source');
      expect(manifest?.source.playlistId).toBe('pl_mf_test');
      expect(manifest?.source.title).toBe('Manifest Test Playlist');
      expect(manifest?.source.owner).toBe('curator_alpha');
      expect(manifest?.destination.name).toBe('in-memory-destination');
      expect(manifest?.lifecycle.status).toBe('completed');
      expect(manifest?.lifecycle.completedAt).toBeDefined();
      expect(manifest?.stats.processedTracks).toBe(1);
      expect(manifest?.stats.writtenTracks).toBe(1);
      expect(manifest?.stats.skippedTracks).toBe(0);
      expect(manifest?.stats.isTruncated).toBe(false);
    });

    it('records cancelled lifecycle when abort signal is triggered', async () => {
      const manifestStore = new InMemoryImportManifestStore();
      const destination = new InMemoryMusicDestination();

      const controller = new AbortController();
      controller.abort(); // pre-aborted

      const source = new InMemoryMusicSource('in-memory-source');
      const engine = new ImportEngine({ source, destination, manifestStore });

      const result = await engine.importPlaylist({
        playlistId: 'pl_abort',
        jobId: 'mf-job-abort',
        signal: controller.signal,
      });

      expect(result.success).toBe(false);

      const manifest = await manifestStore.load('mf-job-abort');
      expect(manifest).not.toBeNull();
      expect(manifest?.lifecycle.status).toBe('cancelled');
      expect(manifest?.error).toBeDefined();
    });

    it('records failed lifecycle and error payload on import failure', async () => {
      const manifestStore = new InMemoryImportManifestStore();
      const destination = new InMemoryMusicDestination();

      const source = new InMemoryMusicSource('in-memory-source'); // Empty source without pl_missing
      const engine = new ImportEngine({ source, destination, manifestStore });

      const result = await engine.importPlaylist({
        playlistId: 'pl_missing',
        jobId: 'mf-job-fail',
      });

      expect(result.success).toBe(false);

      const manifest = await manifestStore.load('mf-job-fail');
      expect(manifest).not.toBeNull();
      expect(manifest?.lifecycle.status).toBe('failed');
      expect(manifest?.stats.failedTracks).toBe(1);
      expect(manifest?.error).toBeDefined();
    });
  });
});
