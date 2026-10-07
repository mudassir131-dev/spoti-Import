/**
 * Spotify Infrastructure - SpotifyPublicPlaylistSource Adapter
 *
 * Implements a credential-free, public Spotify playlist importer.
 * Operates without Spotify Client ID, Client Secret, OAuth, or user access/refresh tokens.
 *
 * Complies with the core MusicSource port contract.
 * Features:
 * - Controlled Spotify playlist URL and ID parsing and validation
 * - Incremental, memory-safe pagination via AsyncIterable streaming
 * - Hard safety enforcement bounded by MAX_IMPORT_TRACKS (10,000)
 * - Robust track normalization with graceful handling of partial/missing metadata
 * - Deterministic error mapping without credential leakage
 */

import { MAX_IMPORT_TRACKS } from '../../core/domain/constants.js';
import type {
  MusicSource,
  SourceTrackPage,
  GetTracksOptions,
} from '../../core/ports/music-source.js';
import type {
  ImportedPlaylist,
  ImportedTrack,
  ImportedArtist,
  ImportedAlbum,
} from '../../core/domain/models.js';
import { ImportCancelledError } from '../../core/domain/errors.js';
import { parseSpotifyPlaylistId } from './spotify-url-parser.js';
import {
  SpotifyUnavailableError,
  SpotifyMalformedResponseError,
  SpotifyNetworkError,
  SpotifyRateLimitError,
} from './client/spotify-errors.js';

export interface SpotifyPublicPlaylistSourceOptions {
  /**
   * Custom fetch function (for deterministic mocked tests or custom HTTP agents)
   */
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
  /**
   * Base URL for Spotify public API (defaults to 'https://api.spotify.com')
   */
  readonly baseUrl?: string;
  /**
   * Default page size per fetch (max 100)
   */
  readonly pageSize?: number;
  /**
   * Maximum retries on 429 or 5xx responses (default: 2)
   */
  readonly maxRetries?: number;
  /**
   * Base delay between retries in milliseconds (default: 500)
   */
  readonly retryDelayMs?: number;
  /**
   * Adapter name identifier (default: 'spotify-public')
   */
  readonly name?: string;
}

export interface StreamableTrackPage extends SourceTrackPage, AsyncIterable<ImportedTrack> {
  [Symbol.asyncIterator](): AsyncIterator<ImportedTrack>;
}

export class SpotifyPublicPlaylistSource implements MusicSource {
  readonly name: string;
  private readonly fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  private readonly baseUrl: string;
  private readonly pageSize: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private anonymousToken?: string;
  private anonymousTokenExpiresAt?: number;

  constructor(options: SpotifyPublicPlaylistSourceOptions = {}) {
    this.name = options.name ?? 'spotify-public';
    this.fetcher = options.fetcher ?? ((url, init) => globalThis.fetch(url, init));
    this.baseUrl = (options.baseUrl ?? 'https://api.spotify.com').replace(/\/+$/, '');
    this.pageSize = Math.min(Math.max(1, options.pageSize ?? 100), 100);
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  /**
   * Fetches public playlist metadata.
   * Validates and accepts either a Spotify URL or a Spotify playlist ID.
   */
  async getPlaylist(playlistIdOrUrl: string, signal?: AbortSignal): Promise<ImportedPlaylist> {
    const playlistId = parseSpotifyPlaylistId(playlistIdOrUrl);
    const data = await this.fetchWithRetry<Record<string, unknown>>(
      `/v1/playlists/${encodeURIComponent(playlistId)}`,
      signal
    );

    if (!data || typeof data !== 'object') {
      throw new SpotifyMalformedResponseError('Received empty or invalid playlist response', {
        playlistId,
      });
    }

    const title = typeof data.name === 'string' && data.name.trim() !== '' ? data.name : 'Untitled Playlist';
    const description = typeof data.description === 'string' ? data.description : undefined;
    const ownerObj = data.owner as Record<string, unknown> | undefined;
    const owner =
      typeof ownerObj?.display_name === 'string'
        ? ownerObj.display_name
        : typeof ownerObj?.id === 'string'
          ? ownerObj.id
          : undefined;

    const tracksObj = data.tracks as Record<string, unknown> | undefined;
    const totalTracks = typeof tracksObj?.total === 'number' ? tracksObj.total : undefined;

    const images = Array.isArray(data.images) ? data.images : [];
    const artwork = typeof images[0]?.url === 'string' ? images[0].url : undefined;

    return {
      source: this.name,
      sourceId: typeof data.id === 'string' ? data.id : playlistId,
      title,
      description,
      owner,
      totalTracks,
      artwork,
      metadata: {
        snapshotId: data.snapshot_id,
        uri: data.uri,
      },
    };
  }

  /**
   * Fetches a single page of tracks according to options.
   * Also implements AsyncIterable so callers can directly stream with `for await (const track of ...)`.
   */
  async getTracks(
    playlistIdOrUrl: string,
    options: GetTracksOptions = {}
  ): Promise<StreamableTrackPage> {
    const playlistId = parseSpotifyPlaylistId(playlistIdOrUrl);
    const offset = options.cursor ? parseInt(options.cursor, 10) || 0 : 0;
    const limit = options.limit !== undefined ? Math.min(options.limit, this.pageSize) : this.pageSize;

    const pageData = await this.fetchTracksPage(playlistId, offset, limit, options.signal);

    const tracks: ImportedTrack[] = [];
    const items = Array.isArray(pageData.items) ? pageData.items : [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.track) {
        // Gracefully ignore null, deleted, or unplayable track items
        continue;
      }
      const normalized = this.normalizeTrack(item.track, offset + i);
      if (normalized) {
        tracks.push(normalized);
      }
    }

    const nextOffset = offset + items.length;
    const total = typeof pageData.total === 'number' ? pageData.total : undefined;
    const hasMore = Boolean(pageData.next) && (total !== undefined ? nextOffset < total : true);
    const nextCursor = hasMore ? String(nextOffset) : undefined;

    const streamGenerator = () => this.getTrackStream(playlistId, options);

    const result: StreamableTrackPage = {
      tracks,
      nextCursor,
      hasMore,
      total,
      [Symbol.asyncIterator]() {
        return streamGenerator()[Symbol.asyncIterator]();
      },
    };

    return result;
  }

  /**
   * Streams tracks incrementally via an async generator without loading all pages into memory.
   * Strictly respects MAX_IMPORT_TRACKS (10,000) safety ceiling.
   */
  async *getTrackStream(
    playlistIdOrUrl: string,
    options: GetTracksOptions = {}
  ): AsyncGenerator<ImportedTrack, void, unknown> {
    const playlistId = parseSpotifyPlaylistId(playlistIdOrUrl);
    const effectiveLimit = Math.min(options.limit ?? MAX_IMPORT_TRACKS, MAX_IMPORT_TRACKS);
    let offset = options.cursor ? parseInt(options.cursor, 10) || 0 : 0;
    let yieldedCount = 0;

    while (yieldedCount < effectiveLimit) {
      if (options.signal?.aborted) {
        throw new ImportCancelledError('aborted', 'Import streaming was cancelled');
      }

      const fetchLimit = Math.min(this.pageSize, effectiveLimit - yieldedCount);
      const pageData = await this.fetchTracksPage(playlistId, offset, fetchLimit, options.signal);

      const items = Array.isArray(pageData.items) ? pageData.items : [];
      if (items.length === 0) {
        break;
      }

      for (let i = 0; i < items.length; i++) {
        if (yieldedCount >= effectiveLimit) {
          break;
        }

        const item = items[i];
        if (!item || !item.track) {
          // Gracefully skip deleted/unavailable tracks without failing the entire stream
          continue;
        }

        const normalized = this.normalizeTrack(item.track, offset + i);
        if (normalized) {
          yieldedCount++;
          yield normalized;
        }
      }

      offset += items.length;
      const total = typeof pageData.total === 'number' ? pageData.total : undefined;
      const hasMore = Boolean(pageData.next) && (total !== undefined ? offset < total : true);

      if (!hasMore) {
        break;
      }
    }
  }

  /**
   * Normalizes a Spotify track payload into canonical ImportedTrack domain entity.
   * Handles missing/incomplete metadata gracefully.
   */
  normalizeTrack(rawTrack: unknown, playlistIndex?: number): ImportedTrack | null {
    if (!rawTrack || typeof rawTrack !== 'object') {
      return null;
    }

    const track = rawTrack as Record<string, unknown>;

    // Source track identifier
    const sourceId =
      typeof track.id === 'string' && track.id.trim() !== ''
        ? track.id.trim()
        : typeof track.uri === 'string' && track.uri.trim() !== ''
          ? track.uri.trim()
          : undefined;

    if (!sourceId) {
      return null;
    }

    // Title fallback
    const title = typeof track.name === 'string' && track.name.trim() !== '' ? track.name.trim() : 'Unknown Title';

    // Artists normalization
    let artists: ImportedArtist[] = [];
    if (Array.isArray(track.artists) && track.artists.length > 0) {
      artists = track.artists
        .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
        .map((a) => ({
          name: typeof a.name === 'string' && a.name.trim() !== '' ? a.name.trim() : 'Unknown Artist',
          sourceId: typeof a.id === 'string' ? a.id : undefined,
        }));
    }
    if (artists.length === 0) {
      artists = [{ name: 'Unknown Artist' }];
    }

    // Album normalization
    let album: ImportedAlbum | undefined;
    if (track.album && typeof track.album === 'object') {
      const alb = track.album as Record<string, unknown>;
      const albImages = Array.isArray(alb.images) ? alb.images : [];
      const albArtwork = typeof albImages[0]?.url === 'string' ? albImages[0].url : undefined;

      album = {
        title: typeof alb.name === 'string' && alb.name.trim() !== '' ? alb.name.trim() : 'Unknown Album',
        sourceId: typeof alb.id === 'string' ? alb.id : undefined,
        releaseDate: typeof alb.release_date === 'string' ? alb.release_date : undefined,
        totalTracks: typeof alb.total_tracks === 'number' ? alb.total_tracks : undefined,
        artwork: albArtwork,
      };
    }

    // Album artist & artwork
    const albumArtist =
      track.album && typeof track.album === 'object' && Array.isArray((track.album as Record<string, unknown>).artists)
        ? ((track.album as Record<string, unknown>).artists as Record<string, unknown>[])[0]?.name as string | undefined
        : undefined;

    const artwork = album?.artwork;

    // Optional audio metadata
    const durationMs = typeof track.duration_ms === 'number' && track.duration_ms >= 0 ? track.duration_ms : undefined;
    const trackNumber = typeof track.track_number === 'number' && track.track_number > 0 ? track.track_number : undefined;
    const discNumber = typeof track.disc_number === 'number' && track.disc_number > 0 ? track.disc_number : undefined;
    const explicit = typeof track.explicit === 'boolean' ? track.explicit : undefined;

    // ISRC identification
    const externalIds = track.external_ids as Record<string, unknown> | undefined;
    const isrc = typeof externalIds?.isrc === 'string' ? externalIds.isrc : undefined;

    return {
      source: this.name,
      sourceId,
      title,
      artists,
      album,
      albumArtist,
      durationMs,
      trackNumber,
      discNumber,
      explicit,
      artwork,
      isrc,
      metadata: {
        playlistIndex,
        uri: track.uri,
        popularity: track.popularity,
        isPlayable: track.is_playable,
      },
    };
  }

  /**
   * Fetches a specific page of tracks from Spotify.
   */
  private async fetchTracksPage(
    playlistId: string,
    offset: number,
    limit: number,
    signal?: AbortSignal
  ): Promise<{ items?: Array<{ track?: unknown }>; total?: number; next?: string | null }> {
    const path = `/v1/playlists/${encodeURIComponent(playlistId)}/tracks?offset=${offset}&limit=${limit}`;
    const data = await this.fetchWithRetry<Record<string, unknown>>(path, signal);

    if (!data || typeof data !== 'object') {
      throw new SpotifyMalformedResponseError('Received malformed tracks response from Spotify', {
        playlistId,
        offset,
      });
    }

    return data as { items?: Array<{ track?: unknown }>; total?: number; next?: string | null };
  }

  /**
   * Internal fetch with retry, error classification, and anonymous credential handling.
   */
  private async fetchWithRetry<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (true) {
      if (signal?.aborted) {
        throw new ImportCancelledError('aborted', 'Request was cancelled');
      }

      attempt++;

      // In production or default fetch, resolve anonymous token if needed
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      const token = await this.getAnonymousToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response: Response;
      try {
        response = await this.fetcher(fullUrl, {
          method: 'GET',
          headers,
          signal,
        });
      } catch (err) {
        if (signal?.aborted) {
          throw new ImportCancelledError('aborted', 'Request was cancelled');
        }
        if (attempt <= this.maxRetries) {
          await this.delay(this.retryDelayMs * attempt);
          continue;
        }
        throw new SpotifyNetworkError(
          `Network connection failed when reaching Spotify endpoint: ${err instanceof Error ? err.message : String(err)}`,
          { endpoint, attempt },
          err
        );
      }

      if (response.ok) {
        try {
          return (await response.json()) as T;
        } catch (jsonErr) {
          throw new SpotifyMalformedResponseError(
            'Failed to parse JSON response from Spotify',
            { endpoint },
            jsonErr
          );
        }
      }

      // Handle 404 / 403 (Unavailable / Private / Deleted playlist)
      if (response.status === 404 || response.status === 403) {
        throw new SpotifyUnavailableError(
          `Spotify playlist is unavailable, private, or not found (HTTP ${response.status})`,
          response.status,
          { endpoint }
        );
      }

      // Handle 429 Rate Limiting
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;

        if (attempt <= this.maxRetries) {
          await this.delay((retryAfterSeconds || 1) * 1000);
          continue;
        }

        throw new SpotifyRateLimitError(
          `Spotify public API rate limit exceeded (HTTP 429). Retry after ${retryAfterSeconds}s`,
          retryAfterSeconds,
          { endpoint }
        );
      }

      // Handle 5xx server errors
      if (response.status >= 500 && attempt <= this.maxRetries) {
        await this.delay(this.retryDelayMs * attempt);
        continue;
      }

      throw new SpotifyUnavailableError(
        `Spotify public endpoint returned unexpected status ${response.status}`,
        response.status,
        { endpoint }
      );
    }
  }

  private anonymousTokenUnavailable = false;

  /**
   * Retrieves an anonymous ephemeral public token from Spotify's open web player endpoint.
   * Completely credential-free: requires no Client ID or Client Secret.
   * If running under custom mock fetchers that don't need tokens, returns undefined silently.
   */
  private async getAnonymousToken(): Promise<string | undefined> {
    if (this.anonymousTokenUnavailable) {
      return undefined;
    }

    const now = Date.now();
    if (this.anonymousToken && this.anonymousTokenExpiresAt && this.anonymousTokenExpiresAt > now) {
      return this.anonymousToken;
    }

    try {
      const anonRes = await this.fetcher(
        'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
        { method: 'GET' }
      );
      if (anonRes.ok) {
        const data = (await anonRes.json()) as { accessToken?: string; accessTokenExpirationTimestampMs?: number };
        if (data.accessToken) {
          this.anonymousToken = data.accessToken;
          this.anonymousTokenExpiresAt = data.accessTokenExpirationTimestampMs ?? now + 3600 * 1000;
          return this.anonymousToken;
        }
      }
      this.anonymousTokenUnavailable = true;
    } catch {
      // If fetching anonymous token fails (e.g. running mock fetcher in unit tests), ignore gracefully
      this.anonymousTokenUnavailable = true;
    }

    return undefined;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
