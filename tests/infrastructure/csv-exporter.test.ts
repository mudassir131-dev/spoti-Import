import { describe, it, expect } from 'vitest';
import {
  CsvMusicDestination,
  ImportEngine,
  InMemoryMusicSource,
  CSV_HEADER,
  CSV_COLUMNS,
  escapeCsvField,
  type ImportedTrack,
  type ImportedPlaylist,
} from '../../src/index.js';

describe('Phase 5 CSV Exporter (PR 3)', () => {
  function makeTrack(overrides: Partial<ImportedTrack> = {}): ImportedTrack {
    return {
      source: 'spotify',
      sourceId: 'trk_default',
      title: 'Default Song',
      artists: [{ name: 'Default Artist' }],
      album: { title: 'Default Album' },
      albumArtist: 'Default Artist',
      durationMs: 180000,
      isrc: 'USRC12345678',
      trackNumber: 1,
      discNumber: 1,
      explicit: false,
      artwork: 'https://example.com/art.jpg',
      ...overrides,
    };
  }

  describe('escapeCsvField unit tests', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('returns unchanged string if no special characters are present', () => {
      expect(escapeCsvField('Bohemian Rhapsody')).toBe('Bohemian Rhapsody');
    });

    it('encloses in double quotes when field contains comma', () => {
      expect(escapeCsvField('Queen, David Bowie')).toBe('"Queen, David Bowie"');
    });

    it('escapes internal double quotes by doubling them', () => {
      expect(escapeCsvField('Hit "Em Up')).toBe('"Hit ""Em Up"');
    });

    it('encloses in double quotes when field contains newlines or CRLF', () => {
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe('CsvMusicDestination integration tests', () => {
    it('produces valid CSV with header for an empty playlist', async () => {
      const destination = new CsvMusicDestination();
      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_empty',
        title: 'Empty',
        totalTracks: 0,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_empty: { playlist, tracks: [] },
      });

      const engine = new ImportEngine({ source, destination });
      const result = await engine.importPlaylist({
        playlistId: 'pl_empty',
        jobId: 'csv-job-empty',
      });

      expect(result.success).toBe(true);

      const csv = destination.getCsvString('csv-job-empty');
      expect(csv).toBe(CSV_HEADER);
    });

    it('exports a single track correctly', async () => {
      const destination = new CsvMusicDestination();
      const track = makeTrack({
        sourceId: 'trk_single',
        title: 'Single Track',
      });

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_single',
        title: 'Single Playlist',
        totalTracks: 1,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_single: { playlist, tracks: [track] },
      });

      const engine = new ImportEngine({ source, destination });
      await engine.importPlaylist({
        playlistId: 'pl_single',
        jobId: 'csv-job-single',
      });

      const csv = destination.getCsvString('csv-job-single');
      const lines = csv.split('\r\n').filter(Boolean);
      expect(lines).toHaveLength(2); // Header + 1 track row
      expect(lines[0]).toBe(CSV_COLUMNS.join(','));
      expect(lines[1]).toContain('spotify,trk_single,Single Track,Default Artist');
    });

    it('handles multiple tracks while preserving ordering and duplicates', async () => {
      const destination = new CsvMusicDestination();
      const tracks = [
        makeTrack({ sourceId: 'trk_1', title: 'Song Alpha' }),
        makeTrack({ sourceId: 'trk_2', title: 'Song Beta' }),
        makeTrack({ sourceId: 'trk_1', title: 'Song Alpha' }), // duplicate
      ];

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_multi',
        title: 'Multi',
        totalTracks: 3,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_multi: { playlist, tracks },
      });

      const engine = new ImportEngine({ source, destination });
      await engine.importPlaylist({
        playlistId: 'pl_multi',
        jobId: 'csv-job-multi',
        deduplicate: false,
      });

      const csv = destination.getCsvString('csv-job-multi');
      const lines = csv.split('\r\n').filter(Boolean);
      expect(lines).toHaveLength(4); // Header + 3 tracks
      expect(lines[1]).toContain('trk_1,Song Alpha');
      expect(lines[2]).toContain('trk_2,Song Beta');
      expect(lines[3]).toContain('trk_1,Song Alpha');
    });

    it('handles Unicode, multilingual text, and special symbols', async () => {
      const destination = new CsvMusicDestination();
      const unicodeTrack = makeTrack({
        sourceId: 'trk_u1',
        title: '夜に駆ける (Racing into the Night) 🎵',
        artists: [{ name: 'YOASOBI (幾田りら / Ayase)' }],
        album: { title: 'THE BOOK - 音楽' },
      });

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_uni',
        title: 'J-Pop Playlist',
        totalTracks: 1,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_uni: { playlist, tracks: [unicodeTrack] },
      });

      const engine = new ImportEngine({ source, destination });
      await engine.importPlaylist({
        playlistId: 'pl_uni',
        jobId: 'csv-job-unicode',
      });

      const csv = destination.getCsvString('csv-job-unicode');
      expect(csv).toContain('夜に駆ける (Racing into the Night) 🎵');
      expect(csv).toContain('YOASOBI (幾田りら / Ayase)');
      expect(csv).toContain('THE BOOK - 音楽');
    });

    it('correctly escapes commas, quotes, and newlines in track metadata', async () => {
      const destination = new CsvMusicDestination();
      const trickyTrack = makeTrack({
        sourceId: 'trk_tricky',
        title: 'Hello, World: The "Remix"\nSpecial Edition',
        artists: [{ name: 'Artist A, Jr.' }, { name: 'DJ "Spin"' }],
        album: { title: 'Greatest, "Hits"\r\nVol. 1' },
      });

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_tricky',
        title: 'Tricky Playlist',
        totalTracks: 1,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_tricky: { playlist, tracks: [trickyTrack] },
      });

      const engine = new ImportEngine({ source, destination });
      await engine.importPlaylist({
        playlistId: 'pl_tricky',
        jobId: 'csv-job-tricky',
      });

      const csv = destination.getCsvString('csv-job-tricky');

      // Commas and quotes must be escaped
      expect(csv).toContain('"Hello, World: The ""Remix""\nSpecial Edition"');
      expect(csv).toContain('"Artist A, Jr.; DJ ""Spin"""');
      expect(csv).toContain('"Greatest, ""Hits""\r\nVol. 1"');
    });

    it('correctly handles missing optional fields with empty strings', async () => {
      const destination = new CsvMusicDestination();
      const minimalTrack: ImportedTrack = {
        source: 'spotify',
        sourceId: 'trk_min',
        title: 'Minimal Song',
        artists: [{ name: 'Solo Artist' }],
        // Album, durationMs, isrc, trackNumber, discNumber, explicit, artwork omitted
      };

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_min',
        title: 'Minimal',
        totalTracks: 1,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_min: { playlist, tracks: [minimalTrack] },
      });

      const engine = new ImportEngine({ source, destination });
      await engine.importPlaylist({
        playlistId: 'pl_min',
        jobId: 'csv-job-min',
      });

      const csv = destination.getCsvString('csv-job-min');
      const lines = csv.split('\r\n').filter(Boolean);
      const row = lines[1]!;

      // Verify trailing missing fields are empty commas
      expect(row).toBe('spotify,trk_min,Minimal Song,Solo Artist,,,,,,,,');
    });

    it('supports streaming chunk writing for large 10,000-track export', async () => {
      let chunksCount = 0;
      let totalBytesWritten = 0;

      const destination = new CsvMusicDestination({
        writeChunk: (chunk) => {
          chunksCount++;
          totalBytesWritten += chunk.length;
        },
        streamOnly: true,
      });

      const tracks: ImportedTrack[] = [];
      for (let i = 0; i < 10_000; i++) {
        tracks.push(
          makeTrack({
            sourceId: `trk_${i}`,
            title: `Track Number ${i}`,
          })
        );
      }

      const playlist: ImportedPlaylist = {
        source: 'spotify',
        sourceId: 'pl_10k_csv',
        title: '10K CSV Playlist',
        totalTracks: 10_000,
      };

      const source = new InMemoryMusicSource('in-memory-source', {
        pl_10k_csv: { playlist, tracks },
      });

      const engine = new ImportEngine({ source, destination });
      const startTime = performance.now();
      const result = await engine.importPlaylist({
        playlistId: 'pl_10k_csv',
        jobId: 'csv-job-10k',
        batchSize: 500,
      });
      const durationMs = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.progress.writtenTracks).toBe(10_000);
      expect(chunksCount).toBeGreaterThanOrEqual(21); // Header + 20 batches
      expect(totalBytesWritten).toBeGreaterThan(1_000_000);
      expect(durationMs).toBeLessThan(10_000);

      // streamOnly disables getCsvString
      expect(() => destination.getCsvString('csv-job-10k')).toThrow();
    });
  });
});
