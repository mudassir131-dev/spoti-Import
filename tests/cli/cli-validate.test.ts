import { describe, it, expect } from 'vitest';
import {
  runCli,
  CliRunner,
  CliExitCode,
  validateCommand,
  createValidateCommand,
  validateJsonContent,
  validateCsvContent,
} from '../../src/index.js';

const VALID_JSON_PAYLOAD = JSON.stringify({
  schemaVersion: 1,
  importId: 'import-12345',
  source: 'spotify',
  status: 'completed',
  playlist: {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: 'Top 50 - Global',
    totalTracks: 2,
  },
  tracks: [
    {
      occurrenceId: 'occ-1',
      position: 0,
      source: 'spotify',
      sourceId: 'track-1',
      title: 'Blinding Lights',
      artists: [{ name: 'The Weeknd' }],
    },
    {
      occurrenceId: 'occ-2',
      position: 1,
      source: 'spotify',
      sourceId: 'track-2',
      title: 'Starboy',
      artists: [{ name: 'The Weeknd' }],
    },
  ],
  exportedAt: new Date().toISOString(),
});

const VALID_CSV_PAYLOAD = [
  'source,sourceId,title,artists,album,albumArtist,durationMs,isrc,trackNumber,discNumber,explicit,artwork',
  'spotify,track-1,Blinding Lights,The Weeknd,After Hours,,200000,USUG11904206,,,,',
  'spotify,track-2,Starboy,The Weeknd,Starboy,,230000,,,,,',
].join('\n');

describe('Phase 7 PR 3 - Validate CLI Command', () => {
  describe('Help and Usage', () => {
    it('shows help for validate command', async () => {
      expect(validateCommand.name).toBe('validate');
      const stdoutLines: string[] = [];

      const exitCode = await runCli(['validate', '--help'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('music-import validate');
      expect(output).toContain('--format');
      expect(output).toContain('--quiet');
    });

    it('rejects execution when file argument is missing', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(['validate'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Missing required argument: <file>');
    });

    it('rejects non-existent file path with exit code 2', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(['validate', './non-existent-file.json'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('File not found');
    });

    it('rejects invalid format option', async () => {
      const stderrLines: string[] = [];
      const runner = new CliRunner();

      const exitCode = await runner.run(
        ['validate', './some-file.txt', '--format', 'yaml'],
        {
          stderr: (msg) => stderrLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Invalid format "yaml"');
    });
  });

  describe('JSON Validation', () => {
    it('validates a correct JSON export file successfully', async () => {
      const stdoutLines: string[] = [];
      const mockCmd = createValidateCommand({
        readFile: async () => VALID_JSON_PAYLOAD,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['validate', './valid-export.json'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Schema Version: 1');
      expect(output).toContain('Top 50 - Global');
      expect(output).toContain('Tracks Validated: 2');
      expect(output).toContain('Status: VALID ✓');
    });

    it('fails on corrupted/malformed JSON syntax with exit code 1', async () => {
      const stdoutLines: string[] = [];
      const mockCmd = createValidateCommand({
        readFile: async () => '{"schemaVersion": 1, "unclosed": ',
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['validate', './corrupt.json'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.ERROR);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Status: INVALID ✗');
      expect(output).toContain('Malformed JSON syntax');
    });

    it('fails when schemaVersion is unsupported (e.g. v2) with exit code 1', async () => {
      const stdoutLines: string[] = [];
      const v2Payload = JSON.stringify({
        schemaVersion: 2,
        importId: 'import-v2',
        source: 'spotify',
        exportedAt: new Date().toISOString(),
        tracks: [],
      });

      const mockCmd = createValidateCommand({
        readFile: async () => v2Payload,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['validate', './future-schema.json'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.ERROR);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Status: INVALID ✗');
      expect(output).toContain('Unsupported schemaVersion');
    });

    it('fails when required payload fields are missing', async () => {
      const stdoutLines: string[] = [];
      const incompletePayload = JSON.stringify({
        schemaVersion: 1,
        // missing importId, source, exportedAt, tracks
      });

      const mockCmd = createValidateCommand({
        readFile: async () => incompletePayload,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['validate', './incomplete.json'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.ERROR);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Status: INVALID ✗');
    });
  });

  describe('CSV Validation', () => {
    it('validates a compliant RFC 4180 CSV file successfully', async () => {
      const stdoutLines: string[] = [];
      const mockCmd = createValidateCommand({
        readFile: async () => VALID_CSV_PAYLOAD,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['validate', './valid-export.csv'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Validating file: ./valid-export.csv (CSV)');
      expect(output).toContain('Tracks Validated: 2');
      expect(output).toContain('Status: VALID ✓');
    });

    it('fails when CSV header is invalid', async () => {
      const stdoutLines: string[] = [];
      const invalidHeaderCsv = 'colA,colB,colC\n1,2,3';

      const mockCmd = createValidateCommand({
        readFile: async () => invalidHeaderCsv,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(
        ['validate', './bad-header.csv', '--format', 'csv'],
        {
          stdout: (msg) => stdoutLines.push(msg),
        }
      );

      expect(exitCode).toBe(CliExitCode.ERROR);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Status: INVALID ✗');
      expect(output).toContain('Invalid CSV header');
    });

    it('fails when CSV has unclosed quote', async () => {
      const stdoutLines: string[] = [];
      const unclosedQuoteCsv =
        'source,sourceId,title,artists,album\nspotify,t1,"Unclosed title,The Artist,Album';

      const mockCmd = createValidateCommand({
        readFile: async () => unclosedQuoteCsv,
      });

      const runner = new CliRunner();
      runner.registerCommand(mockCmd);

      const exitCode = await runner.run(['validate', './unclosed.csv'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.ERROR);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Status: INVALID ✗');
      expect(output).toContain('Unclosed quote');
    });
  });

  describe('Direct Helper Functions', () => {
    it('validateJsonContent and validateCsvContent produce valid reports', () => {
      const jsonReport = validateJsonContent(VALID_JSON_PAYLOAD, 'test.json');
      expect(jsonReport.valid).toBe(true);
      expect(jsonReport.schemaVersion).toBe(1);
      expect(jsonReport.trackCount).toBe(2);

      const csvReport = validateCsvContent(VALID_CSV_PAYLOAD, 'test.csv');
      expect(csvReport.valid).toBe(true);
      expect(csvReport.trackCount).toBe(2);
    });
  });
});
