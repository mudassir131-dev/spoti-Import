/**
 * Universal Music Import Engine - Validate CLI Command
 *
 * Validates exported JSON or CSV playlist files against canonical Schema v1
 * and RFC 4180 structural contracts.
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CURRENT_SCHEMA_VERSION } from '../../core/domain/constants.js';
import { validateUniversalImportPayload } from '../../core/domain/interchange.js';
import { CliExitCode, type CommandDefinition, type CliIo } from '../types.js';
import { CliUsageError } from '../errors.js';

export interface ValidationReport {
  readonly valid: boolean;
  readonly format: 'json' | 'csv';
  readonly filePath: string;
  readonly schemaVersion: number;
  readonly playlistTitle?: string;
  readonly playlistId?: string;
  readonly trackCount: number;
  readonly errors: string[];
}

export interface ValidateCommandDependencies {
  readonly readFile?: (filePath: string) => Promise<string>;
}

/**
 * Validates a CSV string according to RFC 4180 and engine column specifications.
 */
export function validateCsvContent(content: string, filePath: string): ValidationReport {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {
      valid: false,
      format: 'csv',
      filePath,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      trackCount: 0,
      errors: ['CSV file is empty.'],
    };
  }

  const header = lines[0]!;
  const expectedPrefix = 'source,sourceId,title,artists,album';
  if (!header.startsWith(expectedPrefix)) {
    errors.push(
      `Invalid CSV header. Expected header starting with "${expectedPrefix}", received "${header}".`
    );
  }

  let validRowCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]!;
    // Basic comma separation taking quoted strings into account
    const cells: string[] = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let charIndex = 0; charIndex < row.length; charIndex++) {
      const char = row[charIndex]!;
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
        continue;
      }
      currentCell += char;
    }
    cells.push(currentCell.trim());

    if (insideQuotes) {
      errors.push(`Row ${i + 1}: Unclosed quote in CSV row.`);
      continue;
    }

    const source = cells[0];
    const sourceId = cells[1];
    const title = cells[2];

    if (!source || !sourceId || !title) {
      errors.push(`Row ${i + 1}: Missing required fields (source, sourceId, or title).`);
    } else {
      validRowCount++;
    }
  }

  return {
    valid: errors.length === 0,
    format: 'csv',
    filePath,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    trackCount: validRowCount,
    errors,
  };
}

/**
 * Validates a JSON string against UniversalImportPayloadSchema and Schema v1.
 */
export function validateJsonContent(content: string, filePath: string): ValidationReport {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      format: 'json',
      filePath,
      schemaVersion: 0,
      trackCount: 0,
      errors: [`Malformed JSON syntax: ${msg}`],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      format: 'json',
      filePath,
      schemaVersion: 0,
      trackCount: 0,
      errors: ['JSON root must be an object representing UniversalImportPayload.'],
    };
  }

  const rawObj = parsed as Record<string, unknown>;
  const schemaVer = typeof rawObj['schemaVersion'] === 'number' ? rawObj['schemaVersion'] : 0;

  try {
    const payload = validateUniversalImportPayload(parsed);
    return {
      valid: true,
      format: 'json',
      filePath,
      schemaVersion: payload.schemaVersion,
      playlistTitle: payload.playlist?.name,
      playlistId: payload.playlist?.id,
      trackCount: payload.tracks.length,
      errors: [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);

    return {
      valid: false,
      format: 'json',
      filePath,
      schemaVersion: schemaVer,
      trackCount: Array.isArray(rawObj['tracks']) ? rawObj['tracks'].length : 0,
      errors,
    };
  }
}

export function createValidateCommand(deps: ValidateCommandDependencies = {}): CommandDefinition {
  return {
    name: 'validate',
    description: 'Validate an exported JSON or CSV playlist file against canonical Schema v1',
    usage: 'music-import validate <file> [options]',
    examples: [
      'music-import validate ./top50.json',
      'music-import validate ./playlist.csv --format csv',
      'music-import validate ./export.json --quiet',
    ],
    options: {
      format: {
        type: 'string',
        short: 'f',
        description: 'File format: json | csv | auto',
        default: 'auto',
      },
      quiet: {
        type: 'boolean',
        short: 'q',
        description: 'Suppress output and return only exit code',
        default: false,
      },
    },
    execute: async (rawArgs: string[], io: CliIo): Promise<number> => {
      const stdout = io.stdout ?? ((text: string) => process.stdout.write(text + '\n'));
      const stderr = io.stderr ?? ((text: string) => process.stderr.write(text + '\n'));

      let parsed: ReturnType<typeof parseArgs>;
      try {
        parsed = parseArgs({
          args: rawArgs,
          options: {
            format: { type: 'string', short: 'f', default: 'auto' },
            quiet: { type: 'boolean', short: 'q', default: false },
          },
          allowPositionals: true,
          strict: false,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new CliUsageError(msg);
      }

      const { values, positionals } = parsed;
      const targetFile = positionals[0];

      if (!targetFile) {
        throw new CliUsageError(
          'Missing required argument: <file>. Run "music-import validate --help" for usage.'
        );
      }

      // Determine format
      let format = String(values['format'] ?? 'auto').toLowerCase();
      if (format !== 'auto' && format !== 'json' && format !== 'csv') {
        throw new CliUsageError(
          `Invalid format "${format}". Supported formats are "json", "csv", or "auto".`
        );
      }

      // Read file
      let content: string;
      try {
        if (deps.readFile) {
          content = await deps.readFile(targetFile);
        } else {
          const resolvedPath = path.resolve(targetFile);
          if (!fs.existsSync(resolvedPath)) {
            stderr(`Error: File not found: "${targetFile}"`);
            return CliExitCode.INVALID_ARGUMENTS;
          }
          content = await fs.promises.readFile(resolvedPath, 'utf8');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        stderr(`Error reading file "${targetFile}": ${msg}`);
        return CliExitCode.INVALID_ARGUMENTS;
      }

      if (format === 'auto') {
        if (targetFile.endsWith('.csv')) {
          format = 'csv';
        } else {
          format = 'json';
        }
      }

      const report: ValidationReport =
        format === 'csv'
          ? validateCsvContent(content, targetFile)
          : validateJsonContent(content, targetFile);

      const isQuiet = Boolean(values['quiet']);

      if (!isQuiet) {
        stdout(`Validating file: ${targetFile} (${report.format.toUpperCase()})`);
        stdout(`Schema Version: ${report.schemaVersion || 'Unknown'}`);
        if (report.playlistTitle) {
          stdout(`Playlist: "${report.playlistTitle}" (${report.playlistId ?? 'unknown'})`);
        }
        stdout(`Tracks Validated: ${report.trackCount}`);
        stdout(`Status: ${report.valid ? 'VALID ✓' : 'INVALID ✗'}`);

        if (!report.valid) {
          stdout('\nValidation Errors:');
          for (const err of report.errors) {
            stdout(`  - ${err}`);
          }
        }
      }

      if (!report.valid) {
        if (isQuiet) {
          stderr(`Validation failed for "${targetFile}": ${report.errors.join('; ')}`);
        }
        return CliExitCode.ERROR;
      }

      return CliExitCode.SUCCESS;
    },
  };
}

export const validateCommand: CommandDefinition = createValidateCommand();
