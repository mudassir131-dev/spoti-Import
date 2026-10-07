/**
 * In-Memory MusicSource Adapter
 * Used for testing, offline simulation, and reference implementation of MusicSource port.
 */

import type { MusicSource, SourceTrackPage, GetTracksOptions } from '../../core/ports/music-source.js';
import type { ImportedPlaylist, ImportedTrack } from '../../core/domain/models.js';

export interface InMemorySourceData {
  readonly playlist: ImportedPlaylist;
  readonly tracks: readonly ImportedTrack[];
}

export class InMemoryMusicSource implements MusicSource {
  readonly name: string;
  private readonly playlistMap = new Map<string, InMemorySourceData>();

  constructor(name = 'in-memory-source', initialPlaylists: Record<string, InMemorySourceData> = {}) {
    this.name = name;
    for (const [id, data] of Object.entries(initialPlaylists)) {
      this.playlistMap.set(id, data);
    }
  }

  setPlaylistData(playlistId: string, data: InMemorySourceData): void {
    this.playlistMap.set(playlistId, data);
  }

  async getPlaylist(playlistId: string): Promise<ImportedPlaylist> {
    const data = this.playlistMap.get(playlistId);
    if (!data) {
      throw new Error(`Playlist with ID '${playlistId}' not found in in-memory source.`);
    }
    return data.playlist;
  }

  async getTracks(playlistId: string, options: GetTracksOptions = {}): Promise<SourceTrackPage> {
    const data = this.playlistMap.get(playlistId);
    if (!data) {
      throw new Error(`Playlist with ID '${playlistId}' not found in in-memory source.`);
    }

    const limit = options.limit ?? data.tracks.length;
    const tracks = data.tracks.slice(0, limit);

    return {
      tracks,
      hasMore: tracks.length < data.tracks.length,
      total: data.tracks.length,
    };
  }
}
