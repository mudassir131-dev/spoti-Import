import type { ImportedPlaylist, ImportedTrack } from '../domain/models.js';

export interface GetTracksOptions {
  readonly limit?: number;
  readonly cursor?: string;
  readonly signal?: AbortSignal;
}

export interface SourceTrackPage {
  readonly tracks: readonly ImportedTrack[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
  readonly total?: number;
}
