/**
 * Spotify Infrastructure - SpotifyMusicSource Adapter
 * Satisfies the core MusicSource port contract.
 * Translates Spotify API responses into canonical domain models without leaking Spotify-specific types.
 */

import type { MusicSource, SourceTrackPage, GetTracksOptions } from '../../core/ports/music-source.js';
import type {
  ImportedPlaylist,
  ImportedTrack,
  ImportedArtist,
  ImportedAlbum,
} from '../../core/domain/models.js';
import { SourceError } from '../../core/domain/errors.js';
import type { SpotifyHttpClient } from './client/spotify-http-client.js';
import {
  SpotifyPlaylistObjectSchema,
  SpotifyPlaylistTracksResponseSchema,
  type SpotifyTrackObject,
} from './models/spotify-api-types.js';

export interface SpotifyMusicSourceOptions {
  readonly client: SpotifyHttpClient;
  readonly name?: string;
}

export class SpotifyMusicSource implements MusicSource {
  readonly name: string;
  private readonly client: SpotifyHttpClient;

  constructor(optionsOrClient: SpotifyHttpClient | SpotifyMusicSourceOptions) {
    if ('client' in optionsOrClient) {
      this.client = optionsOrClient.client;
      this.name = optionsOrClient.name ?? 'spotify';
    } else {
      this.client = optionsOrClient;
      this.name = 'spotify';
    }
  }

  /**
   * Retrieves Spotify playlist metadata and maps it to the ImportedPlaylist domain model.
   */
  async getPlaylist(playlistId: string, signal?: AbortSignal): Promise<ImportedPlaylist> {
    const encodedId = encodeURIComponent(playlistId.trim());

    try {
      const rawData = await this.client.get<unknown>(`/v1/playlists/${encodedId}`, {
        signal,
      });

      const parseResult = SpotifyPlaylistObjectSchema.safeParse(rawData);
      if (!parseResult.success) {
        throw new Error(
          `Spotify playlist schema validation failed: ${parseResult.error.issues.map((i) => i.message).join(', ')}`
        );
      }

      const playlist = parseResult.data;
      const artwork = playlist.images?.[0]?.url;

      return {
        source: this.name,
        sourceId: playlist.id,
        title: playlist.name,
        description: playlist.description ?? undefined,
        owner: playlist.owner?.display_name ?? playlist.owner?.id ?? undefined,
        totalTracks: playlist.tracks?.total ?? 0,
        artwork,
        metadata: {
          uri: playlist.uri,
          snapshotId: playlist.snapshot_id,
        },
      };
    } catch (err) {
      throw new SourceError(
        `Failed to retrieve Spotify playlist '${playlistId}': ${err instanceof Error ? err.message : String(err)}`,
        { sourceName: this.name, operation: 'getPlaylist', playlistId },
        err
      );
    }
  }

  /**
   * Minimal first-page implementation satisfying the Phase 1 MusicSource contract.
   * Full pagination loop is explicitly deferred to Phase 3.
   */
  async getTracks(playlistId: string, options: GetTracksOptions = {}): Promise<SourceTrackPage> {
    const encodedId = encodeURIComponent(playlistId.trim());

    // Spotify API limit max is 100 per page
    const requestedLimit = options.limit !== undefined ? Math.min(options.limit, 100) : 100;

    try {
      const rawData = await this.client.get<unknown>(`/v1/playlists/${encodedId}/tracks`, {
        params: {
          limit: requestedLimit,
          offset: 0,
        },
        signal: options.signal,
      });

      const parseResult = SpotifyPlaylistTracksResponseSchema.safeParse(rawData);
      if (!parseResult.success) {
        throw new Error(
          `Spotify tracks schema validation failed: ${parseResult.error.issues.map((i) => i.message).join(', ')}`
        );
      }

      const response = parseResult.data;
      const normalizedTracks: ImportedTrack[] = [];

      for (const item of response.items) {
        // Skip null or unavailable track entries (e.g., deleted tracks, local files without metadata, episodes)
        if (!item || !item.track) {
          continue;
        }

        const normalized = this.normalizeTrack(item.track);
        if (normalized) {
          normalizedTracks.push(normalized);
        }
      }

      return {
        tracks: normalizedTracks,
        nextCursor: response.next ?? undefined,
        hasMore: Boolean(response.next),
        total: response.total,
      };
    } catch (err) {
      throw new SourceError(
        `Failed to retrieve tracks for Spotify playlist '${playlistId}': ${err instanceof Error ? err.message : String(err)}`,
        { sourceName: this.name, operation: 'getTracks', playlistId },
        err
      );
    }
  }

  /**
   * Normalizes a Spotify track payload into canonical ImportedTrack domain entity.
   */
  private normalizeTrack(track: SpotifyTrackObject): ImportedTrack | null {
    if (!track.id || !track.name) {
      return null;
    }

    const artists: ImportedArtist[] =
      track.artists && track.artists.length > 0
        ? track.artists.map((a) => ({
            name: a.name,
            sourceId: a.id,
          }))
        : [{ name: 'Unknown Artist' }];

    let album: ImportedAlbum | undefined;
    if (track.album) {
      album = {
        title: track.album.name,
        sourceId: track.album.id,
        releaseDate: track.album.release_date,
        totalTracks: track.album.total_tracks,
        artwork: track.album.images?.[0]?.url,
        artists: track.album.artists?.map((a) => ({
          name: a.name,
          sourceId: a.id,
        })),
      };
    }

    const albumArtist = track.album?.artists?.[0]?.name;
    const artwork = track.album?.images?.[0]?.url;

    return {
      source: this.name,
      sourceId: track.id,
      title: track.name,
      artists,
      album,
      albumArtist,
      durationMs: track.duration_ms,
      isrc: track.external_ids?.isrc,
      trackNumber: track.track_number,
      discNumber: track.disc_number,
      explicit: track.explicit,
      artwork,
      metadata: {
        uri: track.uri,
        popularity: track.popularity,
        isPlayable: track.is_playable,
      },
    };
  }
}

/**
 * Phase 2 Authenticated Spotify Source alias.
 * Allows clear architectural distinction between SpotifyPublicPlaylistSource and SpotifyAuthenticatedSource.
 */
export const SpotifyAuthenticatedSource = SpotifyMusicSource;
export type SpotifyAuthenticatedSource = SpotifyMusicSource;
export type SpotifyAuthenticatedSourceOptions = SpotifyMusicSourceOptions;

