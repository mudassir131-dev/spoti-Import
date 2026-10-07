/**
 * Universal Music Import Engine - Public API
 * Exposes core domain entities, ports, service contracts, and errors.
 */

// Domain constants
export {
  MAX_IMPORT_TRACKS,
  DEFAULT_BATCH_SIZE,
} from './core/domain/constants.js';

// Domain errors
export {
  ImportError,
  ValidationError,
  SourceError,
  DestinationError,
  ImportLimitError,
  ImportCancelledError,
  type ImportErrorPayload,
} from './core/domain/errors.js';

// Domain models & schemas
export {
  ImportedArtistSchema,
  ImportedAlbumSchema,
  ImportedTrackSchema,
  ImportedPlaylistSchema,
  ImportJobStatusSchema,
  type ImportedArtist,
  type ImportedAlbum,
  type ImportedTrack,
  type ImportedPlaylist,
  type ImportJob,
  type ImportProgress,
  type ImportJobStatus,
} from './core/domain/models.js';

// Ports (interfaces)
export type {
  MusicSource,
  GetTracksOptions,
  SourceTrackPage,
} from './core/ports/music-source.js';

export type {
  MusicDestination,
  WriteTracksResult,
} from './core/ports/music-destination.js';

export type {
  TrackNormalizer,
} from './core/ports/track-normalizer.js';

// Services
export {
  ImportEngine,
  type ImportRequest,
  type ImportResult,
  type ImportExecutionOptions,
  type ImportEngineConfig,
} from './core/services/import-engine.js';

export {
  DefaultTrackNormalizer,
} from './core/services/default-track-normalizer.js';

// Reference Infrastructure Adapters
export {
  InMemoryMusicSource,
  InMemoryMusicDestination,
  type InMemorySourceData,
} from './infrastructure/index.js';

// Spotify Infrastructure (Phase 2)
export {
  SpotifyMusicSource,
  type SpotifyMusicSourceOptions,
  SpotifyOAuthService,
  type AuthorizationUrlOptions,
  type SpotifyOAuthOptions,
  DEFAULT_SPOTIFY_SCOPES,
  SpotifyHttpClient,
  type SpotifyHttpClientOptions,
  type SpotifyRequestOptions,
  SpotifyTokenManager,
  type SpotifyTokenProvider,
  type SpotifyTokenManagerOptions,
  createStaticTokenProvider,
  validateSpotifyConfig,
  loadSpotifyConfigFromEnv,
  type SpotifyConfig,
  type SpotifyToken,
  isTokenExpired,
  createSpotifyToken,
  DEFAULT_SAFETY_WINDOW_SECONDS,
  SpotifyConfigError,
  SpotifyAuthError,
  SpotifyApiError,
} from './infrastructure/spotify/index.js';
