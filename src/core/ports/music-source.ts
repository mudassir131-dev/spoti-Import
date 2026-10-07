/**
 * Universal Music Import Engine - MusicSource Port
 * Generic abstraction for external music platforms (Spotify, Apple Music, Tidal, Local files, etc.)
 */

import type { ImportedPlaylist, ImportedTrack } from '../domain/models.js';

export interface GetTracksOptions {
  /**
   * Maximum number of tracks requested in this query/page (bounded by safety limit)
   */
  readonly limit?: number;

  /**
   * Opaque pagination cursor or offset token for future pagination phases
   */
  readonly cursor?: string;

  /**
   * Optional cancellation signal
   */
  readonly signal?: AbortSignal;
}

export interface SourceTrackPage {
  /**
   * Tracks returned in this page/batch
   */
  readonly tracks: readonly ImportedTrack[];

  /**
   * Next pagination cursor token, if available
   */
  readonly nextCursor?: string;

  /**
   * Indicates whether additional tracks remain to be fetched
   */
  readonly hasMore: boolean;

  /**
   * Total track count known by the source, if reported
   */
  readonly total?: number;
}

export interface MusicSource {
  /**
   * Unique identifier or human-readable name of the source adapter (e.g. "mock-source", "spotify")
   */
  readonly name: string;

  /**
   * Fetches playlist metadata
   */
  getPlaylist(playlistId: string, signal?: AbortSignal): Promise<ImportedPlaylist>;

  /**
   * Fetches tracks for the given playlist
   */
  getTracks(playlistId: string, options?: GetTracksOptions): Promise<SourceTrackPage>;

  /**
   * Optional streaming / async iterable generator yielding tracks incrementally.
   * Enables true memory-safe processing without buffering all tracks in an array.
   */
  getTrackStream?(playlistId: string, options?: GetTracksOptions): AsyncIterable<ImportedTrack>;
}

