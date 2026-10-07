import { describe, it, expect } from 'vitest';
import {
  parseSpotifyPlaylistId,
  SpotifyPlaylistUrlError,
} from '../../../src/index.js';

describe('Spotify URL & Identifier Parser', () => {
  describe('Valid Spotify Playlist Formats', () => {
    it('1. Parses standard web playlist URL', () => {
      const id = parseSpotifyPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
      expect(id).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('2. Parses playlist URL with tracking query parameters (?si=...)', () => {
      const id = parseSpotifyPlaylistId(
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=ab12cd34ef56&pt=xyz789'
      );
      expect(id).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('3. Parses localized international playlist URL (/intl-de/playlist/...)', () => {
      const id = parseSpotifyPlaylistId(
        'https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M'
      );
      expect(id).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('4. Parses embed playlist URL (/embed/playlist/...)', () => {
      const id = parseSpotifyPlaylistId(
        'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M'
      );
      expect(id).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('5. Parses standard Spotify URI (spotify:playlist:...)', () => {
      const id = parseSpotifyPlaylistId('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
      expect(id).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('6. Accepts direct raw base62 Spotify alphanumeric ID', () => {
      const id = parseSpotifyPlaylistId('37i9dQZF1DXcBWIGoYBM5M');
      expect(id).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });
  });

  describe('Invalid or Unsupported Resources Rejection', () => {
    it('7. Rejects malformed non-URL string', () => {
      expect(() => parseSpotifyPlaylistId('not-a-valid-url')).toThrow(SpotifyPlaylistUrlError);
      expect(() => parseSpotifyPlaylistId('http://[invalid:host]')).toThrow(SpotifyPlaylistUrlError);
    });

    it('8. Rejects non-Spotify URL cleanly (Apple Music / YouTube)', () => {
      expect(() =>
        parseSpotifyPlaylistId('https://music.apple.com/us/playlist/todays-hits/pl.12345')
      ).toThrow(SpotifyPlaylistUrlError);
      expect(() =>
        parseSpotifyPlaylistId('https://youtube.com/playlist?list=PL1234567890')
      ).toThrow(SpotifyPlaylistUrlError);
    });

    it('9. Rejects Spotify album URL with explanatory error', () => {
      expect(() =>
        parseSpotifyPlaylistId('https://open.spotify.com/album/4aawyAB9vmqN3uQFRjYTkK')
      ).toThrowError(/album/i);

      expect(() =>
        parseSpotifyPlaylistId('spotify:album:4aawyAB9vmqN3uQFRjYTkK')
      ).toThrowError(/album/i);
    });

    it('10. Rejects Spotify track URL with explanatory error', () => {
      expect(() =>
        parseSpotifyPlaylistId('https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl')
      ).toThrowError(/track/i);

      expect(() =>
        parseSpotifyPlaylistId('spotify:track:11dFghVXANMlKmJXsNCbNl')
      ).toThrowError(/track/i);
    });

    it('11. Rejects missing playlist ID in URL or URI', () => {
      expect(() => parseSpotifyPlaylistId('https://open.spotify.com/playlist/')).toThrow(
        SpotifyPlaylistUrlError
      );
      expect(() => parseSpotifyPlaylistId('spotify:playlist:')).toThrow(SpotifyPlaylistUrlError);
      expect(() => parseSpotifyPlaylistId('   ')).toThrow(SpotifyPlaylistUrlError);
    });
  });
});
