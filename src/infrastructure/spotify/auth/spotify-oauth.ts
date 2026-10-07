export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

export const DEFAULT_SPOTIFY_SCOPES: readonly string[] = Object.freeze([
  'playlist-read-private',
  'playlist-read-collaborative',
]);
