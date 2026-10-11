import { describe, it, expect } from 'vitest';
import {
  runCli,
  CliRunner,
  CliExitCode,
  CLI_VERSION,
  formatRootHelp,
  formatCommandHelp,
  versionCommand,
  ImportEngine,
  MAX_IMPORT_TRACKS,
  CURRENT_SCHEMA_VERSION,
} from '../../src/index.js';

describe('Phase 7 PR 1 - CLI Foundation', () => {
  it('preserves existing core public exports while providing CLI exports', () => {
    expect(ImportEngine).toBeDefined();
    expect(MAX_IMPORT_TRACKS).toBe(10_000);
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(runCli).toBeTypeOf('function');
    expect(formatRootHelp).toBeTypeOf('function');
    expect(formatCommandHelp).toBeTypeOf('function');
    expect(versionCommand).toBeDefined();
    expect(versionCommand.name).toBe('version');
    expect(CliExitCode.SUCCESS).toBe(0);
    expect(CliExitCode.ERROR).toBe(1);
    expect(CliExitCode.INVALID_ARGUMENTS).toBe(2);
    expect(CliExitCode.CANCELLED).toBe(130);
  });

  describe('Root Help & Global Flags', () => {
    it('prints root help when no arguments are provided', async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      const exitCode = await runCli([], {
        stdout: (msg) => stdoutLines.push(msg),
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      expect(stderrLines).toHaveLength(0);
      const output = stdoutLines.join('\n');
      expect(output).toContain('Universal Music Import Engine CLI');
      expect(output).toContain('USAGE:');
      expect(output).toContain('COMMANDS:');
      expect(output).toContain('version');
    });

    it('prints root help when --help or -h flag is passed', async () => {
      for (const flag of ['--help', '-h']) {
        const stdoutLines: string[] = [];
        const exitCode = await runCli([flag], {
          stdout: (msg) => stdoutLines.push(msg),
        });

        expect(exitCode).toBe(CliExitCode.SUCCESS);
        const output = stdoutLines.join('\n');
        expect(output).toContain('Universal Music Import Engine CLI');
        expect(output).toContain('-h, --help');
        expect(output).toContain('-v, --version');
      }
    });

    it('prints version when --version or -v flag is passed', async () => {
      for (const flag of ['--version', '-v']) {
        const stdoutLines: string[] = [];
        const exitCode = await runCli([flag], {
          stdout: (msg) => stdoutLines.push(msg),
        });

        expect(exitCode).toBe(CliExitCode.SUCCESS);
        expect(stdoutLines[0]).toBe(`music-import v${CLI_VERSION} (schema v${CURRENT_SCHEMA_VERSION})`);
      }
    });
  });

  describe('Version Command', () => {
    it('executes version command successfully', async () => {
      const stdoutLines: string[] = [];
      const exitCode = await runCli(['version'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      expect(stdoutLines[0]).toBe(`music-import v${CLI_VERSION} (schema v${CURRENT_SCHEMA_VERSION})`);
    });

    it('prints command help when --help is passed to version command', async () => {
      const stdoutLines: string[] = [];
      const exitCode = await runCli(['version', '--help'], {
        stdout: (msg) => stdoutLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.SUCCESS);
      const output = stdoutLines.join('\n');
      expect(output).toContain('music-import version');
      expect(output).toContain('Display CLI version');
    });
  });

  describe('Error Handling and Exit Codes', () => {
    it('returns INVALID_ARGUMENTS (2) for unknown command', async () => {
      const stderrLines: string[] = [];
      const exitCode = await runCli(['unknown-command'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.INVALID_ARGUMENTS);
      expect(stderrLines.join('\n')).toContain('Unknown command "unknown-command"');
    });

    it('custom runner catches and formats errors cleanly', async () => {
      const customRunner = new CliRunner();
      customRunner.registerCommand({
        name: 'failing-command',
        description: 'Command that throws error',
        usage: 'music-import failing-command',
        execute: async () => {
          throw new Error('Something broke');
        },
      });

      const stderrLines: string[] = [];
      const exitCode = await customRunner.run(['failing-command'], {
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(CliExitCode.ERROR);
      expect(stderrLines.join('\n')).toContain('Error: Something broke');
    });
  });
});
