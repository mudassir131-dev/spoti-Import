/**
 * Universal Music Import Engine - Import Interchange Contract (Phase 6)
 *
 * Defines the stable, versioned interchange contract between the TypeScript
 * import engine and the Kotlin/Android Room integration bridge.
 *
 * Requirements:
 * - schemaVersion (explicit versioning)
 * - importId
 * - source
 * - playlist metadata (id, name, description, owner, totalTracks, artwork, metadata)
 * - status (pending, running, completed, failed, cancelled)
 * - isTruncated (truncation metadata)
 * - tracks: ordered track occurrences preserving sequence and repeated occurrences
 * - optional metadata
 * - exportedAt / export timestamp
 * - clear distinction between track identity (sourceId) and playlist occurrence identity (occurrenceId, position)
 */

import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION } from './constants.js';
import {
  ImportedArtistSchema,
  ImportedAlbumSchema,
  ImportJobStatusSchema,
} from './models.js';

/**
 * Playlist metadata in the universal interchange format.
 */
export const UniversalPlaylistMetadataSchema = z.object({
  id: z.string().min(1, 'Playlist ID cannot be empty'),
  name: z.string().min(1, 'Playlist name cannot be empty'),
  description: z.string().optional(),
  owner: z.string().optional(),
  totalTracks: z.number().int().nonnegative().optional(),
  artwork: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UniversalPlaylistMetadata = z.infer<typeof UniversalPlaylistMetadataSchema>;

/**
 * Track occurrence schema.
 * Represents an occurrence of a track at a specific position in a playlist.
 * Distinguishes track identity (sourceId) from playlist occurrence identity (occurrenceId, position).
 */
export const UniversalTrackOccurrenceSchema = z.object({
  occurrenceId: z.string().min(1, 'occurrenceId cannot be empty'),
  position: z.number().int().nonnegative('position must be non-negative'),
  source: z.string().min(1, 'source is required'),
  sourceId: z.string().min(1, 'sourceId is required'),
  title: z.string().min(1, 'Track title cannot be empty'),
  artists: z.array(ImportedArtistSchema).min(1, 'At least one artist is required'),
  album: ImportedAlbumSchema.optional(),
  albumArtist: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  isrc: z.string().optional(),
  trackNumber: z.number().int().positive().optional(),
  discNumber: z.number().int().positive().optional(),
  explicit: z.boolean().optional(),
  artwork: z.string().optional(),
  addedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UniversalTrackOccurrence = z.infer<typeof UniversalTrackOccurrenceSchema>;

/**
 * Progress/statistics schema included in the interchange document for auditability.
 */
export const UniversalImportStatsSchema = z.object({
  processedTracks: z.number().int().nonnegative(),
  writtenTracks: z.number().int().nonnegative(),
  skippedTracks: z.number().int().nonnegative().default(0),
  failedTracks: z.number().int().nonnegative().default(0),
  isTruncated: z.boolean().default(false),
});
export type UniversalImportStats = z.infer<typeof UniversalImportStatsSchema>;

/**
 * Universal Interchange Payload Schema.
 * The canonical contract exported by TypeScript and consumed by Kotlin/Android.
 */
export const UniversalImportPayloadSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  importId: z.string().min(1, 'importId is required'),
  source: z.string().min(1, 'source identifier is required'),
  status: ImportJobStatusSchema.default('completed'),
  playlist: UniversalPlaylistMetadataSchema.optional(),
  isTruncated: z.boolean().default(false),
  tracks: z.array(UniversalTrackOccurrenceSchema),
  stats: UniversalImportStatsSchema.optional(),
  progress: UniversalImportStatsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
  completedAt: z.string().optional(),
  exportedAt: z.string().min(1, 'exportedAt timestamp is required'),
});
export type UniversalImportPayload = z.infer<typeof UniversalImportPayloadSchema>;

/**
 * Validates unknown data against the UniversalImportPayload schema.
 * Throws a ZodError or Error if validation fails or schema version is unsupported.
 */
export function validateUniversalImportPayload(data: unknown): UniversalImportPayload {
  if (data === null || typeof data !== 'object') {
    throw new Error('Payload must be a non-null object');
  }

  const raw = data as Record<string, unknown>;
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion: expected ${CURRENT_SCHEMA_VERSION}, received ${raw.schemaVersion}`
    );
  }

  return UniversalImportPayloadSchema.parse(data);
}
