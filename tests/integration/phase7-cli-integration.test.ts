import { describe, it, expect } from 'vitest';
import {
  runCli,
  CliRunner,
  CliExitCode,
  CLI_VERSION,
  createImportCommand,
  createValidateCommand,
  createInspectCommand,
  MAX_IMPORT_TRACKS,
  CURRENT_SCHEMA_VERSION,
} from '../../src/index.js';
import type { MusicSource } from '../../src/core/ports/music-source.js';
import type { ImportedPlaylist, ImportedTrack } from '../../src/core/domain/models.js';

function generateTracks(count: number): ImportedTrack[] {
  const tracks: ImportedTrack[] = [];
  for (let i = 0; i < count; i++) {
    tracks.push({
      source: 'spotify',
      sourceId: `track-${i + 1}`,
      title: `Track Title ${i + 1}`,
      artists: [{ name: `Artist ${(i % 10) + 1}`, sourceId: `art-${(i % 10) + 1}` }],
      album: { title: `Album ${(i % 5) + 1}`, releaseDate: '2024-01-01' },
      durationMs: 180000 + i * 1000,
      isrc: `USRC${String(i + 1).padStart(8, '0')}`,
      trackNumber: (i % 12) + 1,
      discNumber: 1,
      position: i,
      occurrenceId: `occ-${i + 1}`,
    });
  }
  return tracks;
}

function createIntegrationSource(tracks: ImportedTrack[]): MusicSource {
  const playlist: ImportedPlaylist = {
    source: 'spotify',
    sourceId: '37i9dQZF1DXcBWIGoYBM5M',
    title: 'Integration Test Playlist',
    description: 'Universal integration playlist.',
    owner: 'TestRunner',
    totalTracks: tracks.length,
    artwork: 'https://cdn.example.com/art.jpg',
  };

  return {
    name: 'spotify-integration-mock',
    async getPlaylist() {
      return playlist;
    },
    async getTracks(_id, options) {
      const limit = options?.limit ?? 100;
      return {
        tracks: tracks.slice(0, limit),
        total: tracks.length,
        hasMore: tracks.length > limit,
      };
    },
  };
}

describe('Phase 7 Comprehensive Integration Suite (PR 5)', () => {
  const virtualFs = new Map<string, string>();

  function createTestCli(tracks: ImportedTrack[]) {
    const runner = new CliRunner();
    runner.registerCommand(
      createImportCommand({
        createSource: () => createIntegrationSource(tracks),
        writeFile: async (filePath, data) => {
          virtualFs.set(filePath, data);
        },
      })
    );
    runner.registerCommand(
      createValidateCommand({
        readFile: async (filePath) => {
          const content = virtualFs.get(filePath);
          if (!content) throw new Error(`File not found: ${filePath}`);
          return content;
        },
      })
    );
    runner.registerCommand(
      createInspectCommand({
        createSource: () => createIntegrationSource(tracks),
        fileExists: (filePath) => virtualFs.has(filePath),
        readFile: async (filePath) => {
          const content = virtualFs.get(filePath);
          if (!content) throw new Error(`File not found: ${filePath}`);
          return content;
        },
      })
    );
    return runner;
  }

  it('Scenario 1: Global CLI dispatch and top-level flags conformance', async () => {
    const stdoutHelp: string[] = [];
    const exitCodeHelp = await runCli(['--help'], {
      stdout: (msg) => stdoutHelp.push(msg),
    });
    expect(exitCodeHelp).toBe(CliExitCode.SUCCESS);
    expect(stdoutHelp.join('\n')).toContain('Universal Music Import Engine CLI');

    const stdoutVer: string[] = [];
    const exitCodeVer = await runCli(['--version'], {
      stdout: (msg) => stdoutVer.push(msg),
    });
    expect(exitCodeVer).toBe(CliExitCode.SUCCESS);
    expect(stdoutVer[0]).toBe(`music-import v${CLI_VERSION} (schema v${CURRENT_SCHEMA_VERSION})`);
  });

  it('Scenario 2: End-to-end import to JSON -> validate -> inspect pipeline', async () => {
    const tracks = generateTracks(20);
    const cli = createTestCli(tracks);
    const filePath = './exports/top20.json';

    // 1. Import
    const importStdout: string[] = [];
    const importExit = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '--out', filePath, '--batch-size', '10'],
      { stdout: (msg) => importStdout.push(msg) }
    );
    expect(importExit).toBe(CliExitCode.SUCCESS);
    expect(virtualFs.has(filePath)).toBe(true);

    // 2. Validate
    const validateStdout: string[] = [];
    const validateExit = await cli.run(['validate', filePath], {
      stdout: (msg) => validateStdout.push(msg),
    });
    expect(validateExit).toBe(CliExitCode.SUCCESS);
    const validateOutput = validateStdout.join('\n');
    expect(validateOutput).toContain('Status: VALID ✓');
    expect(validateOutput).toContain('Tracks Validated: 20');

    // 3. Inspect
    const inspectStdout: string[] = [];
    const inspectExit = await cli.run(['inspect', filePath, '--sample', '3'], {
      stdout: (msg) => inspectStdout.push(msg),
    });
    expect(inspectExit).toBe(CliExitCode.SUCCESS);
    const inspectOutput = inspectStdout.join('\n');
    expect(inspectOutput).toContain('Target Type:   LOCAL-JSON');
    expect(inspectOutput).toContain('Total Tracks:  20');
    expect(inspectOutput).toContain('1. Track Title 1 - Artist 1');
  });

  it('Scenario 3: End-to-end import to CSV -> validate -> inspect pipeline', async () => {
    const tracks = generateTracks(15);
    const cli = createTestCli(tracks);
    const filePath = './exports/top15.csv';

    // 1. Import CSV
    const importExit = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '-f', 'csv', '-o', filePath],
      { stdout: () => {} }
    );
    expect(importExit).toBe(CliExitCode.SUCCESS);
    expect(virtualFs.has(filePath)).toBe(true);

    // 2. Validate CSV
    const validateStdout: string[] = [];
    const validateExit = await cli.run(['validate', filePath, '-f', 'csv'], {
      stdout: (msg) => validateStdout.push(msg),
    });
    expect(validateExit).toBe(CliExitCode.SUCCESS);
    expect(validateStdout.join('\n')).toContain('Status: VALID ✓');

    // 3. Inspect CSV
    const inspectStdout: string[] = [];
    const inspectExit = await cli.run(['inspect', filePath, '-s', '2'], {
      stdout: (msg) => inspectStdout.push(msg),
    });
    expect(inspectExit).toBe(CliExitCode.SUCCESS);
    expect(inspectStdout.join('\n')).toContain('Target Type:   LOCAL-CSV');
    expect(inspectStdout.join('\n')).toContain('Total Tracks:  15');
  });

  it('Scenario 4: JSON import with --pretty produces indented schema-compliant interchange format', async () => {
    const tracks = generateTracks(5);
    const cli = createTestCli(tracks);
    const filePath = './exports/pretty.json';

    const exitCode = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '--pretty', '--out', filePath],
      { stdout: () => {} }
    );

    expect(exitCode).toBe(CliExitCode.SUCCESS);
    const rawContent = virtualFs.get(filePath)!;
    expect(rawContent).toContain('  "schemaVersion": 1,');
    expect(rawContent).toContain('  "tracks": [');

    const parsed = JSON.parse(rawContent);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.tracks).toHaveLength(5);
  });

  it('Scenario 5: Multi-batch import (500 tracks) streams across batch boundaries', async () => {
    const tracks = generateTracks(500);
    const cli = createTestCli(tracks);
    const filePath = './exports/large.json';

    const exitCode = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '--batch-size', '50', '--out', filePath],
      { stdout: () => {} }
    );

    expect(exitCode).toBe(CliExitCode.SUCCESS);
    const parsed = JSON.parse(virtualFs.get(filePath)!);
    expect(parsed.tracks).toHaveLength(500);
  });

  it('Scenario 6: Playlist exceeding 10,000 ceiling is capped and marked as truncated', async () => {
    // Generate over ceiling
    const tracks = generateTracks(MAX_IMPORT_TRACKS + 50);
    const cli = createTestCli(tracks);
    const filePath = './exports/ceiling.json';

    const exitCode = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '--out', filePath],
      { stdout: () => {} }
    );

    expect(exitCode).toBe(CliExitCode.SUCCESS);
    const parsed = JSON.parse(virtualFs.get(filePath)!);
    expect(parsed.tracks).toHaveLength(MAX_IMPORT_TRACKS);
    expect(parsed.isTruncated).toBe(true);
  });

  it('Scenario 7: AbortSignal cancellation midway terminates import with exit code 130', async () => {
    const tracks = generateTracks(100);
    const controller = new AbortController();
    controller.abort();

    const cli = createTestCli(tracks);
    const stderrLines: string[] = [];

    const exitCode = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '--out', './exports/cancelled.json'],
      {
        stderr: (msg) => stderrLines.push(msg),
        signal: controller.signal,
      }
    );

    expect(exitCode).toBe(CliExitCode.CANCELLED);
    expect(stderrLines.join('\n')).toContain('cancelled');
  });

  it('Scenario 8: Deduplication flag (--deduplicate) suppresses duplicate sourceId tracks', async () => {
    const rawTracks = generateTracks(3);
    // Add duplicates
    rawTracks.push({ ...rawTracks[0]!, occurrenceId: 'occ-dup-1', position: 3 });
    rawTracks.push({ ...rawTracks[1]!, occurrenceId: 'occ-dup-2', position: 4 });

    const cli = createTestCli(rawTracks);
    const filePath = './exports/dedup.json';

    const exitCode = await cli.run(
      ['import', '37i9dQZF1DXcBWIGoYBM5M', '--deduplicate', '--out', filePath],
      { stdout: () => {} }
    );

    expect(exitCode).toBe(CliExitCode.SUCCESS);
    const parsed = JSON.parse(virtualFs.get(filePath)!);
    expect(parsed.tracks).toHaveLength(3);
  });

  it('Scenario 9: Zero secret leakage: credentials in options are strictly sanitised and never emitted', async () => {
    const tracks = generateTracks(2);
    const cli = createTestCli(tracks);
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const filePath = './exports/sanitized.json';

    const secretToken = 'SUPER_SECRET_CLIENT_TOKEN_XYZ123';
    const exitCode = await cli.run(
      [
        'import',
        '37i9dQZF1DXcBWIGoYBM5M',
        '--client-id',
        'my-client-id',
        '--client-secret',
        secretToken,
        '--out',
        filePath,
      ],
      {
        stdout: (msg) => stdoutLines.push(msg),
        stderr: (msg) => stderrLines.push(msg),
      }
    );

    expect(exitCode).toBe(CliExitCode.SUCCESS);

    const fullStdout = stdoutLines.join('\n');
    const fullStderr = stderrLines.join('\n');
    const fileContent = virtualFs.get(filePath)!;

    expect(fullStdout).not.toContain(secretToken);
    expect(fullStderr).not.toContain(secretToken);
    expect(fileContent).not.toContain(secretToken);
  });

  it('Scenario 10: Exit code contract compliance across command executions', async () => {
    const cli = createTestCli(generateTracks(2));

    // Success (0)
    expect(await cli.run(['version'])).toBe(CliExitCode.SUCCESS);

    // Invalid arguments (2)
    expect(await cli.run(['non-existent-cmd'])).toBe(CliExitCode.INVALID_ARGUMENTS);
    expect(await cli.run(['import'])).toBe(CliExitCode.INVALID_ARGUMENTS);
    expect(await cli.run(['validate'])).toBe(CliExitCode.INVALID_ARGUMENTS);
    expect(await cli.run(['inspect'])).toBe(CliExitCode.INVALID_ARGUMENTS);
  });
});
