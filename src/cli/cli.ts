/**
 * Universal Music Import Engine - CLI Core Dispatcher
 */

import { CliExitCode, type CliIo, type CommandDefinition } from './types.js';
import { CliError } from './errors.js';
import { formatRootHelp, formatCommandHelp } from './help.js';
import { versionCommand, CLI_VERSION } from './commands/version.js';
import { CURRENT_SCHEMA_VERSION } from '../core/domain/constants.js';

export class CliRunner {
  private readonly commands = new Map<string, CommandDefinition>();

  constructor() {
    this.registerCommand(versionCommand);
  }

  registerCommand(command: CommandDefinition): void {
    this.commands.set(command.name, command);
  }

  getCommand(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  async run(rawArgs: string[], io: CliIo = {}): Promise<number> {
    const stdout = io.stdout ?? ((text: string) => process.stdout.write(text + '\n'));
    const stderr = io.stderr ?? ((text: string) => process.stderr.write(text + '\n'));

    try {
      const args = [...rawArgs];

      // Handle empty arguments or root help
      if (args.length === 0) {
        stdout(formatRootHelp(this.getCommands()));
        return CliExitCode.SUCCESS;
      }

      // Handle top-level version flag
      if (args[0] === '--version' || args[0] === '-v') {
        stdout(`music-import v${CLI_VERSION} (schema v${CURRENT_SCHEMA_VERSION})`);
        return CliExitCode.SUCCESS;
      }

      // Handle top-level help flag
      if (args[0] === '--help' || args[0] === '-h') {
        stdout(formatRootHelp(this.getCommands()));
        return CliExitCode.SUCCESS;
      }

      const commandName = args[0]!;
      const commandArgs = args.slice(1);

      const command = this.getCommand(commandName);
      if (!command) {
        stderr(`Error: Unknown command "${commandName}".`);
        stderr('Run "music-import --help" to see available commands.');
        return CliExitCode.INVALID_ARGUMENTS;
      }

      // Check if command-level help is requested
      if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
        stdout(formatCommandHelp(command));
        return CliExitCode.SUCCESS;
      }

      return await command.execute(commandArgs, { ...io, stdout, stderr });
    } catch (err: unknown) {
      if (err instanceof CliError) {
        stderr(`Error: ${err.message}`);
        return err.exitCode;
      }

      const message = err instanceof Error ? err.message : String(err);
      stderr(`Error: ${message}`);
      return CliExitCode.ERROR;
    }
  }
}

// Global default CLI instance
export const defaultCli = new CliRunner();

export async function runCli(args: string[], io?: CliIo): Promise<number> {
  return defaultCli.run(args, io);
}
