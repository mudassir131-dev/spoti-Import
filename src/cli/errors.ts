/**
 * Universal Music Import Engine - CLI Errors
 */

import { CliExitCode } from './types.js';

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = CliExitCode.ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CliUsageError extends CliError {
  constructor(message: string) {
    super(message, CliExitCode.INVALID_ARGUMENTS);
    this.name = 'CliUsageError';
  }
}

export class CliExecutionError extends CliError {
  constructor(message: string, exitCode: number = CliExitCode.ERROR) {
    super(message, exitCode);
    this.name = 'CliExecutionError';
  }
}
