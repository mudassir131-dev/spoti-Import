/**
 * Universal Music Import Engine - Public API
 * Exposes core domain entities, ports, service contracts, and errors.
 */

// Domain constants
export {
  MAX_IMPORT_TRACKS,
  DEFAULT_BATCH_SIZE,
  CURRENT_SCHEMA_VERSION,
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
  ImportCheckpointSchema,
  ExportResultSchema,
  type ImportedArtist,
  type ImportedAlbum,
  type ImportedTrack,
  type ImportedPlaylist,
  type ImportJob,
  type ImportProgress,
  type ImportJobStatus,
  type ImportCheckpoint,
  type ExportResult,
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
  WriteBatchContext,
  ImportMetadata,
} from './core/ports/music-destination.js';


export type {
  TrackNormalizer,
} from './core/ports/track-normalizer.js';

export type {
  CheckpointStore,
} from './core/ports/checkpoint-store.js';

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
  InMemoryCheckpointStore,
  type InMemorySourceData,
  JsonMusicDestination,
  type JsonDestinationOptions,
} from './infrastructure/index.js';


// Spotify Infrastructure (Phase 2 & Phase 3)
export {
  SpotifyMusicSource,
  SpotifyAuthenticatedSource,
  type SpotifyMusicSourceOptions,
  type SpotifyAuthenticatedSourceOptions,
  SpotifyPublicPlaylistSource,
  type SpotifyPublicPlaylistSourceOptions,
  type StreamableTrackPage,
  parseSpotifyPlaylistId,
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
  SpotifyPlaylistUrlError,
  SpotifyUnavailableError,
  SpotifyMalformedResponseError,
  SpotifyNetworkError,
  SpotifyRateLimitError,
} from './infrastructure/spotify/index.js';

