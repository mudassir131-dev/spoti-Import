/**
 * Spotify Infrastructure - URL and Identifier Parser
 * Extracts and strictly validates Spotify playlist identifiers.
 * Rejects unsupported resources (albums, tracks, artists) and non-Spotify sources cleanly.
 */

import { SpotifyPlaylistUrlError } from './client/spotify-errors.js';

/**
 * Validates and extracts a canonical Spotify playlist ID from a URL, URI, or ID string.
 *
 * Supported formats:
 * - https://open.spotify.com/playlist/{id}
 * - https://open.spotify.com/intl-{lang}/playlist/{id}
 * - https://open.spotify.com/embed/playlist/{id}
 * - spotify:playlist:{id}
 * - Pure alphanumeric Spotify playlist ID (base62)
 *
 * Rejects:
 * - Malformed URLs
 * - Non-Spotify URLs
 * - Spotify album URLs
 * - Spotify track URLs
 * - Missing playlist IDs
 */
export function parseSpotifyPlaylistId(input: string): string {
  if (typeof input !== 'string') {
    throw new SpotifyPlaylistUrlError('Playlist reference must be a string');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new SpotifyPlaylistUrlError('Playlist reference cannot be empty');
  }

  // Handle Spotify URI format (spotify:<type>:<id>)
  if (trimmed.startsWith('spotify:')) {
    const parts = trimmed.split(':');
    const type = parts[1];
    const id = parts[2]?.trim();

    if (!type || (type === 'playlist' && (!id || id === ''))) {
      throw new SpotifyPlaylistUrlError('Missing playlist ID in Spotify URI');
    }

    if (type !== 'playlist') {
      throw new SpotifyPlaylistUrlError(
        `Unsupported Spotify resource type '${type}'. Expected a playlist URI.`
      );
    }

    if (!id) {
      throw new SpotifyPlaylistUrlError('Missing playlist ID in Spotify URI');
    }

    return validateId(id);
  }


  // Handle HTTP / HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new SpotifyPlaylistUrlError(`Malformed URL: '${trimmed}'`);
    }

    const host = url.hostname.toLowerCase();
    if (host !== 'open.spotify.com' && !host.endsWith('.spotify.com')) {
      throw new SpotifyPlaylistUrlError(
        `Unsupported source URL domain '${url.hostname}'. Expected Spotify (open.spotify.com).`
      );
    }

    const segments = url.pathname.split('/').filter(Boolean);

    const albumIndex = segments.indexOf('album');
    if (albumIndex !== -1) {
      throw new SpotifyPlaylistUrlError(
        "Unsupported Spotify resource type: 'album'. Expected a playlist URL."
      );
    }

    const trackIndex = segments.indexOf('track');
    if (trackIndex !== -1) {
      throw new SpotifyPlaylistUrlError(
        "Unsupported Spotify resource type: 'track'. Expected a playlist URL."
      );
    }

    const artistIndex = segments.indexOf('artist');
    if (artistIndex !== -1) {
      throw new SpotifyPlaylistUrlError(
        "Unsupported Spotify resource type: 'artist'. Expected a playlist URL."
      );
    }

    const playlistIndex = segments.indexOf('playlist');
    if (playlistIndex === -1) {
      throw new SpotifyPlaylistUrlError(
        `Unsupported Spotify URL path '${url.pathname}'. Expected a playlist path (/playlist/{id}).`
      );
    }

    const id = segments[playlistIndex + 1];
    if (!id || id.trim() === '') {
      throw new SpotifyPlaylistUrlError('Missing playlist ID in Spotify URL');
    }

    return validateId(id.trim());
  }

  // Handle direct alphanumeric Spotify identifier
  if (/^[a-zA-Z0-9]{15,35}$/.test(trimmed)) {
    return trimmed;
  }

  throw new SpotifyPlaylistUrlError(
    `Invalid Spotify playlist identifier or malformed URL: '${trimmed}'`
  );
}

function validateId(id: string): string {
  const cleanId = id.split('?')[0]!.split('#')[0]!;
  if (!cleanId || !/^[a-zA-Z0-9_-]{1,64}$/.test(cleanId)) {
    throw new SpotifyPlaylistUrlError(
      `Invalid Spotify playlist ID format: '${cleanId}'. Expected alphanumeric identifier.`
    );
  }
  return cleanId;
}
