/**
 * Universal Music Import Engine - Import CLI Command
 *
 * Imports playlist tracks into canonical JSON or CSV format.
 * Fully decoupled from specific storage or networks via ports and dependency injection.
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MAX_IMPORT_TRACKS } from '../../core/domain/constants.js';
import { ImportEngine } from '../../core/services/import-engine.js';
import { ImportCancelledError } from '../../core/domain/errors.js';
import type { MusicSource } from '../../core/ports/music-source.js';
import type { MusicDestination } from '../../core/ports/music-destination.js';
import { JsonMusicDestination } from '../../infrastructure/exporters/json-music-destination.js';
import { CsvMusicDestination } from '../../infrastructure/exporters/csv-music-destination.js';
import { SpotifyPublicPlaylistSource } from '../../infrastructure/spotify/spotify-public-playlist-source.js';
import { parseSpotifyPlaylistId } from '../../infrastructure/spotify/spotify-url-parser.js';
import { CliExitCode, type CommandDefinition, type CliIo } from '../types.js';
import { CliUsageError } from '../errors.js';

export interface ImportCommandDependencies {
  readonly createSource?: (options: {
    playlistId: string;
    publicOnly: boolean;
    clientId?: string;
    clientSecret?: string;
    market?: string;
  }) => MusicSource;
  readonly createDestination?: (format: 'json' | 'csv', options: { pretty?: boolean }) => MusicDestination;
  readonly writeFile?: (filePath: string, data: string) => Promise<void>;
}

export function createImportCommand(deps: ImportCommandDependencies = {}): CommandDefinition {
  return {
    name: 'import',
    description: 'Import Spotify playlist tracks into universal JSON or CSV format',
    usage: 'music-import import <playlist> [options]',
    examples: [
      'music-import import 37i9dQZF1DXcBWIGoYBM5M --format json --out ./top50.json',
      'music-import import https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M -f csv -o ./top50.csv',
      'music-import import 37i9dQZF1DXcBWIGoYBM5M --public --pretty',
      'music-import import 37i9dQZF1DXcBWIGoYBM5M --limit 50 --batch-size 25',
    ],
    options: {
      format: {
        type: 'string',
        short: 'f',
        description: 'Output format: json | csv',
        default: 'json',
      },
      out: {
        type: 'string',
        short: 'o',
        description: 'Output file path (omitted or "-" writes to stdout)',
      },
      'batch-size': {
        type: 'number',
        short: 'b',
        description: 'Batch chunk size (1 to 10000)',
        default: 100,
      },
      limit: {
        type: 'number',
        short: 'l',
        description: 'Maximum number of tracks to import (up to 10000)',
      },
      pretty: {
        type: 'boolean',
        short: 'p',
        description: 'Format JSON output with 2-space indentation',
        default: false,
      },
      deduplicate: {
        type: 'boolean',
        short: 'd',
        description: 'Deduplicate tracks by source ID',
        default: false,
      },
      public: {
        type: 'boolean',
        description: 'Use public credential-free Spotify web scraper',
        default: true,
      },
      'client-id': {
        type: 'string',
        description: 'Spotify Developer Client ID',
      },
      'client-secret': {
        type: 'string',
        description: 'Spotify Developer Client Secret',
      },
      quiet: {
        type: 'boolean',
        short: 'q',
        description: 'Suppress progress output',
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
            format: { type: 'string', short: 'f', default: 'json' },
            out: { type: 'string', short: 'o' },
            'batch-size': { type: 'string', short: 'b', default: '100' },
            limit: { type: 'string', short: 'l' },
            pretty: { type: 'boolean', short: 'p', default: false },
            deduplicate: { type: 'boolean', short: 'd', default: false },
            public: { type: 'boolean', default: false },
            'client-id': { type: 'string' },
            'client-secret': { type: 'string' },
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

      // Validate required positional playlist argument
      const playlistInput = positionals[0];
      if (!playlistInput) {
        throw new CliUsageError(
          'Missing required argument: <playlist>. Run "music-import import --help" for usage.'
        );
      }

      // Parse and validate playlist identifier
      let playlistId: string;
      try {
        playlistId = parseSpotifyPlaylistId(playlistInput);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new CliUsageError(`Invalid Spotify playlist reference: ${msg}`);
      }

      // Validate format
      const formatStr = String(values['format'] ?? 'json').toLowerCase();
      if (formatStr !== 'json' && formatStr !== 'csv') {
        throw new CliUsageError(
          `Invalid format "${formatStr}". Supported formats are "json" and "csv".`
        );
      }
      const format = formatStr as 'json' | 'csv';

      // Validate batch size
      const batchSize = Number(values['batch-size'] ?? 100);
      if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new CliUsageError('Option --batch-size must be a positive integer.');
      }
      if (batchSize > MAX_IMPORT_TRACKS) {
        throw new CliUsageError(`Option --batch-size cannot exceed ${MAX_IMPORT_TRACKS}.`);
      }

      // Validate limit
      let limit: number | undefined;
      if (values['limit'] !== undefined) {
        limit = Number(values['limit']);
        if (!Number.isInteger(limit) || limit <= 0) {
          throw new CliUsageError('Option --limit must be a positive integer.');
        }
        if (limit > MAX_IMPORT_TRACKS) {
          throw new CliUsageError(`Option --limit cannot exceed ${MAX_IMPORT_TRACKS}.`);
        }
      }

      const isQuiet = Boolean(values['quiet']);
      const isPretty = Boolean(values['pretty']);
      const isDeduplicate = Boolean(values['deduplicate']);

      // Instantiate destination
      let destination: MusicDestination;
      if (deps.createDestination) {
        destination = deps.createDestination(format, { pretty: isPretty });
      } else if (format === 'csv') {
        destination = new CsvMusicDestination();
      } else {
        destination = new JsonMusicDestination({ pretty: isPretty });
      }

      // Instantiate source
      let source: MusicSource;
      if (deps.createSource) {
        source = deps.createSource({
          playlistId,
          publicOnly: Boolean(values['public']),
          clientId: values['client-id'] as string | undefined,
          clientSecret: values['client-secret'] as string | undefined,
        });
      } else {
        source = new SpotifyPublicPlaylistSource();
      }

      if (!isQuiet) {
        stdout(`Importing playlist "${playlistId}" via ${source.name}...`);
      }

      const engine = new ImportEngine({
        source,
        destination,
        defaultBatchSize: batchSize,
        throwOnError: false,
      });

      const result = await engine.importPlaylist({
        playlistId,
        limit,
        batchSize,
        deduplicate: isDeduplicate,
        signal: io.signal,
      });

      if (!result.success) {
        if (result.error instanceof ImportCancelledError || io.signal?.aborted) {
          stderr('Import cancelled.');
          return CliExitCode.CANCELLED;
        }
        stderr(`Import error: ${result.error?.message ?? 'Unknown error occurred'}`);
        return CliExitCode.ERROR;
      }

      // Extract output string
      let outputData: string;
      if (destination instanceof CsvMusicDestination) {
        outputData = destination.getCsvString(result.job.id);
      } else if (destination instanceof JsonMusicDestination) {
        outputData = destination.getJsonString(result.job.id);
      } else {
        // Fallback or custom destination
        outputData = JSON.stringify(result.progress);
      }

      const outputPath = values['out'] ? String(values['out']) : undefined;
      if (outputPath && outputPath !== '-') {
        if (deps.writeFile) {
          await deps.writeFile(outputPath, outputData);
        } else {
          const fullPath = path.resolve(outputPath);
          const dir = path.dirname(fullPath);
          await fs.promises.mkdir(dir, { recursive: true });
          await fs.promises.writeFile(fullPath, outputData, 'utf8');
        }
        if (!isQuiet) {
          const truncNotice = result.isTruncated ? ' (truncated at ceiling)' : '';
          stdout(
            `Successfully imported ${result.progress.writtenTracks} tracks to ${outputPath}${truncNotice}`
          );
        }
      } else {
        stdout(outputData);
      }

      return CliExitCode.SUCCESS;
    },
  };
}

export const importCommand: CommandDefinition = createImportCommand();
