import { describe, it, expect } from 'vitest';
import {
  runCli,
  CliRunner,
  CliExitCode,
  inspectCommand,
  createInspectCommand,
} from '../../src/index.js';
import type { MusicSource } from '../../src/core/ports/music-source.js';
import type { ImportedPlaylist, ImportedTrack } from '../../src/core/domain/models.js';

const MOCK_PLAYLIST: ImportedPlaylist = {
  source: 'spotify',
  sourceId: '37i9dQZF1DXcBWIGoYBM5M',
  title: "Today's Top Hits",
  description: 'The hottest tracks right now.',
  owner: 'Spotify',
  totalTracks: 50,
  artwork: 'https://i.scdn.co/image/ab67706f00000002123456789',
};

const MOCK_TRACKS: ImportedTrack[] = [
  {
    source: 'spotify',
    sourceId: 't1',
    title: 'Espresso',
    artists: [{ name: 'Sabrina Carpenter' }],
    album: { title: 'Short n Sweet' },
    durationMs: 175000,
    isrc: 'USUM72403305',
    position: 0,
    occurrenceId: 'occ-1',
  },
  {
    source: 'spotify',
    sourceId: 't2',
    title: 'Birds of a Feather',
    artists: [{ name: 'Billie Eilish' }],
    album: { title: 'Hit Me Hard and Soft' },
    durationMs: 190000,
    position: 1,
    occurrenceId: 'occ-2',
  },
];

function createMockSource(): MusicSource {
  return {
    name: 'spotify-mock',
    async getPlaylist() {
      return MOCK_PLAYLIST;
    },
    async getTracks() {
      return {
        tracks: MOCK_TRACKS,
        total: 50,
        hasMore: true,
      };
    },
  };
}

describe('Phase 7 PR 4 - Inspect CLI Command', () => {
  describe('Help and Usage', () => {
    it('shows help for inspect command', async () => {
      expect(inspectCommand.name).toBe('inspect');
      const stdoutLines: string[] = [];

      const exitCode = await runCli(['inspect', '--help'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('music-import inspect');
      expect(output).toContain('--sample');
      expect(output).toContain('--json');
    });

    it('rejects execution when target argument is missing', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(['inspect'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Missing required argument: <target>');
    });

    it('rejects invalid sample number', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(
        ['inspect', '37i9dQZF1DXcBWIGoYBM5M', '--sample', '-2'],
        {
          stderr: (msg) => stderrLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Option --sample must be a non-negative integer');
    });

    it('rejects invalid target reference', async () => {
      const stderrLines: string[] = [];
      const mockCmd = createInspectCommand({
        fileExists: () => false,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['inspect', 'https://soundcloud.com/invalid'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('neither an existing file nor a valid Spotify playlist reference');
    });
  });

  describe('Inspect Remote Spotify Playlist', () => {
    it('inspects Spotify playlist in human-readable format', async () => {
      const stdoutLines: string[] = [];
      const mockCmd = createInspectCommand({
        fileExists: () => false,
        createSource: () => createMockSource(),
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['inspect', 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', '--sample', '2'],
        {
          stdout: (msg) => stdoutLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Target Type:   SPOTIFY-REMOTE');
      expect(output).toContain("Title:         Today's Top Hits");
      expect(output).toContain('Total Tracks:  50');
      expect(output).toContain('1. Espresso - Sabrina Carpenter (Short n Sweet)');
      expect(output).toContain('2. Birds of a Feather - Billie Eilish');
    });

    it('inspects Spotify playlist in JSON format with --json flag', async () => {
      const stdoutLines: string[] = [];
      const mockCmd = createInspectCommand({
        fileExists: () => false,
        createSource: () => createMockSource(),
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['inspect', '37i9dQZF1DXcBWIGoYBM5M', '--json'],
        {
          stdout: (msg) => stdoutLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const parsed = JSON.parse(stdoutLines.join(''));
      expect(parsed.targetType).toBe('spotify-remote');
      expect(parsed.title).toBe("Today's Top Hits");
      expect(parsed.totalTracks).toBe(50);
      expect(parsed.sampleTracks).toHaveLength(2);
      expect(parsed.sampleTracks[0].title).toBe('Espresso');
    });

    it('handles remote source network error gracefully', async () => {
      const stderrLines: string[] = [];
      const mockCmd = createInspectCommand({
        fileExists: () => false,
        createSource: () => ({
          name: 'spotify',
          async getPlaylist() {
            throw new Error('Network timeout connecting to Spotify API');
          },
          async getTracks() {
            return { tracks: [], total: 0, hasMore: false };
          },
        }),
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['inspect', '37i9dQZF1DXcBWIGoYBM5M'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.ERROR);
      expect(stderrLines.join('\n')).toContain('Network timeout');
    });
  });

  describe('Inspect Local Files', () => {
    it('inspects a local JSON export file', async () => {
      const stdoutLines: string[] = [];
      const jsonContent = JSON.stringify({
        schemaVersion: 1,
        playlist: {
          id: 'local-123',
          name: 'My Road Trip',
          totalTracks: 1,
        },
        tracks: [
          {
            title: 'Highway to Hell',
            artists: [{ name: 'AC/DC' }],
            album: { title: 'Highway to Hell' },
            durationMs: 208000,
          },
        ],
      });

      const mockCmd = createInspectCommand({
        fileExists: (p) => p.includes('roadtrip.json'),
        readFile: async () => jsonContent,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['inspect', './roadtrip.json'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Target Type:   LOCAL-JSON');
      expect(output).toContain('Title:         My Road Trip');
      expect(output).toContain('Total Tracks:  1');
      expect(output).toContain('1. Highway to Hell - AC/DC (Highway to Hell)');
    });

    it('inspects a local CSV export file', async () => {
      const stdoutLines: string[] = [];
      const csvContent = [
        'source,sourceId,title,artists,album',
        'spotify,s1,"Rolling in the Deep","Adele","21"',
      ].join('\n');

      const mockCmd = createInspectCommand({
        fileExists: (p) => p.includes('adele.csv'),
        readFile: async () => csvContent,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['inspect', './adele.csv'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Target Type:   LOCAL-CSV');
      expect(output).toContain('Title:         adele');
      expect(output).toContain('Total Tracks:  1');
      expect(output).toContain('1. Rolling in the Deep - Adele (21)');
    });
  });
});
