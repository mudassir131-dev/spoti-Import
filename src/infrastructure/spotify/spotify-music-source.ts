import type { MusicSource, SourceTrackPage, GetTracksOptions } from '../../core/ports/music-source.js';
import type { ImportedPlaylist } from '../../core/domain/models.js';
import type { SpotifyHttpClient } from './client/spotify-http-client.js';

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

  async getPlaylist(_playlistId: string): Promise<ImportedPlaylist> {
    throw new Error('Not implemented yet');
  }

  async getTracks(_playlistId: string, _options?: GetTracksOptions): Promise<SourceTrackPage> {
    throw new Error('Not implemented yet');
  }
}
