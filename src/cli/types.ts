/**
 * Universal Music Import Engine - CLI Types and Exit Codes
 */

export enum CliExitCode {
  SUCCESS = 0,
  ERROR = 1,
  INVALID_ARGUMENTS = 2,
  CANCELLED = 130,
}

export interface CliIo {
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
  readonly exit?: (code: number) => void;
  readonly signal?: AbortSignal;
}

export interface CommandOptionDefinition {
  readonly type: 'string' | 'boolean' | 'number';
  readonly short?: string;
  readonly description: string;
  readonly default?: unknown;
  readonly required?: boolean;
}

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly examples?: readonly string[];
  readonly options?: Record<string, CommandOptionDefinition>;
  readonly execute: (args: string[], io: CliIo) => Promise<number>;
}
