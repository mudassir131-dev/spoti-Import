import { type SpotifyToken } from '../auth/spotify-token.js';

export interface SpotifyTokenProvider {
  getValidAccessToken(signal?: AbortSignal): Promise<string>;
  getToken(): SpotifyToken;
}
