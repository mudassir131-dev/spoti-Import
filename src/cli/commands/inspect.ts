/**
 * Universal Music Import Engine - Inspect CLI Command
 *
 * Inspects a Spotify playlist or an existing export file without full ingestion.
 * Displays playlist metadata, track counts, and sample track summaries.
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MusicSource } from '../../core/ports/music-source.js';
import type { ImportedPlaylist, ImportedTrack } from '../../core/domain/models.js';
import { SpotifyPublicPlaylistSource } from '../../infrastructure/spotify/spotify-public-playlist-source.js';
import { parseSpotifyPlaylistId } from '../../infrastructure/spotify/spotify-url-parser.js';
import { CliExitCode, type CommandDefinition, type CliIo } from '../types.js';
import { CliUsageError } from '../errors.js';

export interface InspectionSummary {
  readonly targetType: 'spotify-remote' | 'local-json' | 'local-csv';
  readonly target: string;
  readonly id?: string;
  readonly title: string;
  readonly description?: string;
  readonly owner?: string;
  readonly totalTracks: number;
  readonly artwork?: string;
  readonly sampleTracks: ReadonlyArray<{
    readonly position: number;
    readonly title: string;
    readonly artists: string;
    readonly album?: string;
    readonly isrc?: string;
    readonly durationMs?: number;
  }>;
}

export interface InspectCommandDependencies {
  readonly createSource?: (options: {
    playlistId: string;
    publicOnly: boolean;
    clientId?: string;
    clientSecret?: string;
  }) => MusicSource;
  readonly readFile?: (filePath: string) => Promise<string>;
  readonly fileExists?: (filePath: string) => boolean;
}

export function createInspectCommand(deps: InspectCommandDependencies = {}): CommandDefinition {
  return {
    name: 'inspect',
    description: 'Inspect a Spotify playlist or exported file to inspect metadata and sample tracks',
    usage: 'music-import inspect <target> [options]',
    examples: [
      'music-import inspect 37i9dQZF1DXcBWIGoYBM5M',
      'music-import inspect https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M --sample 10',
      'music-import inspect ./top50.json --json',
      'music-import inspect ./playlist.csv',
    ],
    options: {
      sample: {
        type: 'number',
        short: 's',
        description: 'Number of sample tracks to inspect (default: 5)',
        default: 5,
      },
      json: {
        type: 'boolean',
        description: 'Output inspection report in JSON format',
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
    },
    execute: async (rawArgs: string[], io: CliIo): Promise<number> => {
      const stdout = io.stdout ?? ((text: string) => process.stdout.write(text + '\n'));
      const stderr = io.stderr ?? ((text: string) => process.stderr.write(text + '\n'));

      let parsed: ReturnType<typeof parseArgs>;
      try {
        parsed = parseArgs({
          args: rawArgs,
          options: {
            sample: { type: 'string', short: 's', default: '5' },
            json: { type: 'boolean', default: false },
            public: { type: 'boolean', default: false },
            'client-id': { type: 'string' },
            'client-secret': { type: 'string' },
          },
          allowPositionals: true,
          strict: false,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new CliUsageError(msg);
      }

      const { values, positionals } = parsed;
      const target = positionals[0];

      if (!target) {
        throw new CliUsageError(
          'Missing required argument: <target>. Run "music-import inspect --help" for usage.'
        );
      }

      const sampleCount = Number(values['sample'] ?? 5);
      if (!Number.isInteger(sampleCount) || sampleCount < 0) {
        throw new CliUsageError('Option --sample must be a non-negative integer.');
      }

      const isJsonOutput = Boolean(values['json']);
      let summary: InspectionSummary;

      // Check if target is a local file
      const checkExists = deps.fileExists ?? ((p) => fs.existsSync(path.resolve(p)));
      const isFile = checkExists(target);

      if (isFile) {
        // Inspect local file
        let content: string;
        try {
          if (deps.readFile) {
            content = await deps.readFile(target);
          } else {
            content = await fs.promises.readFile(path.resolve(target), 'utf8');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          stderr(`Error reading file "${target}": ${msg}`);
          return CliExitCode.INVALID_ARGUMENTS;
        }

        const isCsv = target.endsWith('.csv');
        if (isCsv) {
          const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const trackRows = lines.slice(1);
          const samples = trackRows.slice(0, sampleCount).map((row, idx) => {
            const parts = row.split(',');
            return {
              position: idx,
              title: parts[2]?.replace(/^"|"$/g, '') ?? 'Unknown',
              artists: parts[3]?.replace(/^"|"$/g, '') ?? 'Unknown',
              album: parts[4]?.replace(/^"|"$/g, ''),
              isrc: parts[7],
            };
          });

          summary = {
            targetType: 'local-csv',
            target,
            title: path.basename(target, '.csv'),
            totalTracks: trackRows.length,
            sampleTracks: samples,
          };
        } else {
          // Parse JSON
          let parsedData: Record<string, unknown>;
          try {
            parsedData = JSON.parse(content) as Record<string, unknown>;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            stderr(`Malformed JSON in file "${target}": ${msg}`);
            return CliExitCode.ERROR;
          }

          const playlist = parsedData['playlist'] as Record<string, unknown> | undefined;
          const tracks = Array.isArray(parsedData['tracks'])
            ? (parsedData['tracks'] as Array<Record<string, unknown>>)
            : [];

          const samples = tracks.slice(0, sampleCount).map((t, idx) => {
            const artists = Array.isArray(t['artists'])
              ? (t['artists'] as Array<{ name?: string }>).map((a) => a.name ?? '').join(', ')
              : 'Unknown';
            const albumObj = t['album'] as { title?: string } | undefined;
            return {
              position: idx,
              title: String(t['title'] ?? 'Unknown'),
              artists,
              album: albumObj?.title,
              isrc: typeof t['isrc'] === 'string' ? t['isrc'] : undefined,
              durationMs: typeof t['durationMs'] === 'number' ? t['durationMs'] : undefined,
            };
          });

          summary = {
            targetType: 'local-json',
            target,
            id: playlist?.id ? String(playlist.id) : undefined,
            title: playlist?.name ? String(playlist.name) : path.basename(target, '.json'),
            description: playlist?.description ? String(playlist.description) : undefined,
            owner: playlist?.owner ? String(playlist.owner) : undefined,
            totalTracks: tracks.length,
            artwork: playlist?.artwork ? String(playlist.artwork) : undefined,
            sampleTracks: samples,
          };
        }
      } else {
        // Inspect remote Spotify playlist
        let playlistId: string;
        try {
          playlistId = parseSpotifyPlaylistId(target);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new CliUsageError(
            `Target "${target}" is neither an existing file nor a valid Spotify playlist reference: ${msg}`
          );
        }

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

        let playlist: ImportedPlaylist;
        let sampleTracks: ReadonlyArray<ImportedTrack> = [];

        try {
          playlist = await source.getPlaylist(playlistId, io.signal);
          if (sampleCount > 0) {
            const page = await source.getTracks(playlistId, {
              limit: sampleCount,
              signal: io.signal,
            });
            sampleTracks = page.tracks.slice(0, sampleCount);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          stderr(`Failed to inspect playlist "${playlistId}": ${msg}`);
          return CliExitCode.ERROR;
        }

        summary = {
          targetType: 'spotify-remote',
          target,
          id: playlist.sourceId,
          title: playlist.title,
          description: playlist.description,
          owner: playlist.owner,
          totalTracks: playlist.totalTracks ?? sampleTracks.length,
          artwork: playlist.artwork,
          sampleTracks: sampleTracks.map((t, idx) => ({
            position: t.position ?? idx,
            title: t.title,
            artists: t.artists.map((a) => a.name).join(', '),
            album: t.album?.title,
            isrc: t.isrc,
            durationMs: t.durationMs,
          })),
        };
      }

      if (isJsonOutput) {
        stdout(JSON.stringify(summary, null, 2));
        return CliExitCode.SUCCESS;
      }

      // Format human-friendly inspection report
      stdout('----------------------------------------------------');
      stdout(`Target Type:   ${summary.targetType.toUpperCase()}`);
      stdout(`Reference:     ${summary.target}`);
      if (summary.id) {
        stdout(`Playlist ID:   ${summary.id}`);
      }
      stdout(`Title:         ${summary.title}`);
      if (summary.owner) {
        stdout(`Owner:         ${summary.owner}`);
      }
      if (summary.description) {
        stdout(`Description:   ${summary.description}`);
      }
      stdout(`Total Tracks:  ${summary.totalTracks}`);
      if (summary.artwork) {
        stdout(`Artwork URL:   ${summary.artwork}`);
      }

      if (summary.sampleTracks.length > 0) {
        stdout(`\nSample Tracks (first ${summary.sampleTracks.length}):`);
        for (const track of summary.sampleTracks) {
          const durStr = track.durationMs
            ? ` [${Math.floor(track.durationMs / 60000)}:${String(
                Math.floor((track.durationMs % 60000) / 1000)
              ).padStart(2, '0')}]`
            : '';
          const albumStr = track.album ? ` (${track.album})` : '';
          const isrcStr = track.isrc ? ` {ISRC: ${track.isrc}}` : '';
          stdout(`  ${track.position + 1}. ${track.title} - ${track.artists}${albumStr}${durStr}${isrcStr}`);
        }
      }
      stdout('----------------------------------------------------');

      return CliExitCode.SUCCESS;
    },
  };
}

export const inspectCommand: CommandDefinition = createInspectCommand();
