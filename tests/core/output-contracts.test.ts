import { describe, it, expect, vi } from 'vitest';
import {
  ExportResultSchema,
  CURRENT_SCHEMA_VERSION,
  type ExportResult,
  type ImportMetadata,
  type MusicDestination,
  type ImportedTrack,
  type ImportedPlaylist,
  InMemoryMusicDestination,
  ImportEngine,
  InMemoryMusicSource,
} from '../../src/index.js';

describe('Phase 5 Output Contracts (PR 1)', () => {
  describe('ExportResultSchema', () => {
    it('validates a complete ExportResult successfully', () => {
      const validResult: ExportResult = {
        format: 'json',
        importId: 'test-import-123',
        destinationName: 'json-exporter',
        trackCount: 42,
        writtenCount: 42,
        skippedCount: 3,
        failedCount: 0,
        isTruncated: false,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: '2026-10-08T10:00:00.000Z',
        completedAt: '2026-10-08T10:01:00.000Z',
        metadata: {
          playlistTitle: 'Rock Classics',
          exporterVersion: '0.1.0',
        },
      };

      const parsed = ExportResultSchema.parse(validResult);
      expect(parsed).toEqual(validResult);
      expect(parsed.schemaVersion).toBe(1);
    });

    it('applies sensible defaults for optional counts and schemaVersion', () => {
      const minimalResult = {
        format: 'csv',
        importId: 'minimal-job-456',
        destinationName: 'csv-destination',
        trackCount: 10,
        writtenCount: 10,
        createdAt: '2026-10-08T10:00:00.000Z',
      };

      const parsed = ExportResultSchema.parse(minimalResult);
      expect(parsed.skippedCount).toBe(0);
      expect(parsed.failedCount).toBe(0);
      expect(parsed.isTruncated).toBe(false);
      expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('rejects invalid or missing required fields', () => {
      expect(() =>
        ExportResultSchema.parse({
          format: '', // Empty format
          importId: 'job-1',
          destinationName: 'dest',
          trackCount: 5,
          writtenCount: 5,
          createdAt: new Date().toISOString(),
        })
      ).toThrow();

      expect(() =>
        ExportResultSchema.parse({
          format: 'json',
          importId: '', // Empty importId
          destinationName: 'dest',
          trackCount: 5,
          writtenCount: 5,
          createdAt: new Date().toISOString(),
        })
      ).toThrow();

      expect(() =>
        ExportResultSchema.parse({
          format: 'json',
          importId: 'job-1',
          destinationName: '', // Empty destinationName
          trackCount: 5,
          writtenCount: 5,
          createdAt: new Date().toISOString(),
        })
      ).toThrow();

      expect(() =>
        ExportResultSchema.parse({
          format: 'json',
          importId: 'job-1',
          destinationName: 'dest',
          trackCount: -1, // Negative count
          writtenCount: 5,
          createdAt: new Date().toISOString(),
        })
      ).toThrow();
    });
  });

  describe('MusicDestination Lifecycle Contract', () => {
    it('supports destination receiving initialize, writeTracks, commit, and complete', async () => {
      const initializeMock = vi.fn();
      const completeMock = vi.fn();
      const commitMock = vi.fn();
      const rollbackMock = vi.fn();
      const writeMock = vi.fn().mockResolvedValue({ writtenCount: 1 });

      const mockDestination: MusicDestination = {
        name: 'test-custom-destination',
        initialize: initializeMock,
        writeTracks: writeMock,
        commit: commitMock,
        rollback: rollbackMock,
        complete: completeMock,
      };

      const track: ImportedTrack = {
        source: 'spotify',
        sourceId: 'track_1',
        title: 'Song One',
        artists: [{ name: 'Artist One' }],
      };

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_1',
        title: 'Test Playlist',
        totalTracks: 1,
        description: 'My Description',
        owner: 'TestUser',
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_1: {
          playlist,
          tracks: [track],
        },
      });

      const engine = new ImportEngine({
        source,
        destination: mockDestination,
      });

      const result = await engine.importPlaylist({
        playlistId: 'pl_1',
        jobId: 'contract-job-1',
      });

      expect(result.success).toBe(true);

      // Verify initialize hook received metadata
      expect(initializeMock).toHaveBeenCalledTimes(1);
      const initMetadata: ImportMetadata = initializeMock.mock.calls[0]![0];
      expect(initMetadata.importId).toBe('contract-job-1');
      expect(initMetadata.playlistId).toBe('pl_1');
      expect(initMetadata.playlistTitle).toBe('Test Playlist');
      expect(initMetadata.sourceName).toBe('in-memory-source');
      expect(initMetadata.owner).toBe('TestUser');
      expect(initMetadata.totalTracks).toBe(1);

      // Verify batch writing
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(commitMock).toHaveBeenCalledTimes(2); // Batch commit + final transaction commit

      // Verify completion hook
      expect(completeMock).toHaveBeenCalledTimes(1);
      const [completeJobId, completeSummary] = completeMock.mock.calls[0]!;
      expect(completeJobId).toBe('contract-job-1');
      expect(completeSummary.trackCount).toBe(1);
      expect(completeSummary.writtenCount).toBe(1);
      expect(completeSummary.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('works seamlessly with InMemoryMusicDestination reference implementation', async () => {
      const destination = new InMemoryMusicDestination();
      const track: ImportedTrack = {
        source: 'spotify',
        sourceId: 'track_alpha',
        title: 'Alpha Track',
        artists: [{ name: 'Band' }],
      };

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_ref',
        title: 'Reference Suite',
        totalTracks: 1,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_ref: {
          playlist,
          tracks: [track],
        },
      });

      const engine = new ImportEngine({ source, destination });
      const result = await engine.importPlaylist({
        playlistId: 'pl_ref',
        jobId: 'ref-job-99',
      });

      expect(result.success).toBe(true);
      expect(destination.metadataByJob.get('ref-job-99')?.playlistTitle).toBe('Reference Suite');

      const exportResult = await destination.getExportResult('ref-job-99');
      expect(exportResult).not.toBeNull();
      expect(exportResult?.importId).toBe('ref-job-99');
      expect(exportResult?.trackCount).toBe(1);
      expect(exportResult?.writtenCount).toBe(1);
      expect(exportResult?.schemaVersion).toBe(1);
    });

    it('calls rollback on destination failure and does not call complete', async () => {
      const rollbackMock = vi.fn();
      const completeMock = vi.fn();

      const failingDestination: MusicDestination = {
        name: 'failing-dest',
        async writeTracks() {
          throw new Error('Destination write failure');
        },
        async commit() {},
        rollback: rollbackMock,
        complete: completeMock,
      };

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_fail',
        title: 'Fail Playlist',
        totalTracks: 1,
      };

      const track: ImportedTrack = {
        source: 'spotify',
        sourceId: 'tr_1',
        title: 'Song',
        artists: [{ name: 'A' }],
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_fail: {
          playlist,
          tracks: [track],
        },
      });

      const engine = new ImportEngine({ source, destination: failingDestination });
      const result = await engine.importPlaylist({ playlistId: 'pl_fail' });

      expect(result.success).toBe(false);
      expect(rollbackMock).toHaveBeenCalled();
      expect(completeMock).not.toHaveBeenCalled();
    });
  });
});
