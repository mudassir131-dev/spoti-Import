import { describe, it, expect } from 'vitest';
import {
  runCli,
  CliRunner,
  CliExitCode,
  createImportCommand,
  importCommand,
} from '../../src/index.js';
import type { MusicSource } from '../../src/core/ports/music-source.js';
import type { ImportedPlaylist, ImportedTrack } from '../../src/core/domain/models.js';

function createMockSource(tracks: ImportedTrack[] = []): MusicSource {
  const playlist: ImportedPlaylist = {
    source: 'spotify',
    sourceId: '37i9dQZF1DXcBWIGoYBM5M',
    title: 'Today Top Hits',
    totalTracks: tracks.length,
  };

  return {
    name: 'mock-source',
    async getPlaylist() {
      return playlist;
    },
    async getTracks() {
      return {
        tracks,
        total: tracks.length,
        hasMore: false,
      };
    },
  };
}

const SAMPLE_TRACKS: ImportedTrack[] = [
  {
    source: 'spotify',
    sourceId: 'track1',
    title: 'Blinding Lights',
    artists: [{ name: 'The Weeknd' }],
    album: { title: 'After Hours' },
    durationMs: 200000,
    isrc: 'USUG11904206',
    position: 0,
    occurrenceId: 'occ-1',
  },
  {
    source: 'spotify',
    sourceId: 'track2',
    title: 'Starboy',
    artists: [{ name: 'The Weeknd' }, { name: 'Daft Punk' }],
    album: { title: 'Starboy' },
    durationMs: 230000,
    position: 1,
    occurrenceId: 'occ-2',
  },
];

describe('Phase 7 PR 2 - Import CLI Command', () => {
  describe('Help and Usage', () => {
    it('shows help for import command with --help', async () => {
      expect(importCommand.name).toBe('import');
      const stdoutLines: string[] = [];

      const exitCode = await runCli(['import', '--help'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('music-import import');
      expect(output).toContain('--format');
      expect(output).toContain('--out');
      expect(output).toContain('--batch-size');
      expect(output).toContain('--limit');
      expect(output).toContain('--pretty');
    });

    it('rejects execution when playlist argument is missing', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(['import'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Missing required argument: <playlist>');
    });

    it('rejects invalid playlist reference', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(['import', 'https://apple.com/playlist/123'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Invalid Spotify playlist reference');
    });

    it('rejects invalid format option', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '--format', 'xml'],
        {
          stderr: (msg) => stderrLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Invalid format "xml"');
    });

    it('rejects non-positive or excessive batch size', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode1 = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '--batch-size', '0'],
        { stderr: (msg) => stderrLines.push(msg) }
      );
      expect(exitCode1).toBe(CliExitCode.INVALID_ARGUMENTS);

      const exitCode2 = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '--batch-size', '15000'],
        { stderr: (msg) => stderrLines.push(msg) }
      );
      expect(exitCode2).toBe(CliExitCode.INVALID_ARGUMENTS);
    });

    it('rejects non-positive or excessive limit', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '--limit', '-5'],
        { stderr: (msg) => stderrLines.push(msg) }
      );
      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
    });
  });

  describe('Import Execution', () => {
    it('executes JSON import to stdout', async () => {
      const stdoutLines: string[] = [];
      const writtenFiles = new Map<string, string>();

      const mockCmd = createImportCommand({
        createSource: () => createMockSource(SAMPLE_TRACKS),
        writeFile: async (p, d) => {
          writtenFiles.set(p, d);
        },
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '--quiet'],
        {
          stdout: (msg) => stdoutLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const jsonOutput = stdoutLines.join('');
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.tracks).toHaveLength(2);
      expect(parsed.tracks[0].title).toBe('Blinding Lights');
    });

    it('executes JSON import to specified file path with pretty printing', async () => {
      const stdoutLines: string[] = [];
      const writtenFiles = new Map<string, string>();

      const mockCmd = createImportCommand({
        createSource: () => createMockSource(SAMPLE_TRACKS),
        writeFile: async (p, d) => {
          writtenFiles.set(p, d);
        },
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '--out', './out/playlist.json', '--pretty'],
        {
          stdout: (msg) => stdoutLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      expect(writtenFiles.has('./out/playlist.json')).toBe(true);

      const writtenContent = writtenFiles.get('./out/playlist.json')!;
      expect(writtenContent).toContain('  "schemaVersion": 1');
      const parsed = JSON.parse(writtenContent);
      expect(parsed.tracks).toHaveLength(2);
      expect(stdoutLines.some((l) => l.includes('Successfully imported 2 tracks'))).toBe(true);
    });

    it('executes CSV import to specified file path', async () => {
      const stdoutLines: string[] = [];
      const writtenFiles = new Map<string, string>();

      const mockCmd = createImportCommand({
        createSource: () => createMockSource(SAMPLE_TRACKS),
        writeFile: async (p, d) => {
          writtenFiles.set(p, d);
        },
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M', '-f', 'csv', '-o', './out/playlist.csv'],
        {
          stdout: (msg) => stdoutLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      expect(writtenFiles.has('./out/playlist.csv')).toBe(true);

      const csvContent = writtenFiles.get('./out/playlist.csv')!;
      expect(csvContent).toContain('source,sourceId,title,artists,album');
      expect(csvContent).toContain('spotify,track1,Blinding Lights,The Weeknd,After Hours');
      expect(csvContent).toContain('spotify,track2,Starboy,The Weeknd; Daft Punk,Starboy');
    });

    it('handles cancellation gracefully with exit code 130', async () => {
      const stderrLines: string[] = [];
      const controller = new AbortController();
      controller.abort(); // already aborted

      const mockCmd = createImportCommand({
        createSource: () => createMockSource(SAMPLE_TRACKS),
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M'],
        {
          stderr: (msg) => stderrLines.push(msg),
          signal: controller.signal,
        }
      );

      expect(exitCode).toBe(CliExitCode.CANCELLED);
      expect(stderrLines.join('\n')).toContain('cancelled');
    });

    it('handles source errors gracefully with exit code 1', async () => {
      const stderrLines: string[] = [];

      const mockCmd = createImportCommand({
        createSource: () => ({
          name: 'failing-source',
          async getPlaylist() {
            throw new Error('Spotify API 404 Playlist Not Found');
          },
          async getTracks() {
            return { tracks: [], total: 0, hasMore: false };
          },
        }),
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['import', '37i9dQZF1DXcBWIGoYBM5M'],
        {
          stderr: (msg) => stderrLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.ERROR);
      expect(stderrLines.join('\n')).toContain('Failed to fetch playlist');
    });
  });
});
