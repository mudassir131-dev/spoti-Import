/**
 * Universal Music Import Engine - Core Domain Models & Schemas
 * Defines typed entities and runtime Zod validation schemas.
 */

import { z } from 'zod';
import type { ImportErrorPayload } from './errors.js';

/**
 * Artist domain model
 */
export const ImportedArtistSchema = z.object({
  name: z.string().min(1, 'Artist name cannot be empty'),
  sourceId: z.string().optional(),
  roles: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedArtist = z.infer<typeof ImportedArtistSchema>;

/**
 * Album domain model
 */
export const ImportedAlbumSchema = z.object({
  title: z.string().min(1, 'Album title cannot be empty'),
  sourceId: z.string().optional(),
  releaseDate: z.string().optional(),
  totalTracks: z.number().int().nonnegative().optional(),
  artists: z.array(ImportedArtistSchema).optional(),
  artwork: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedAlbum = z.infer<typeof ImportedAlbumSchema>;

/**
 * Track domain model
 */
export const ImportedTrackSchema = z.object({
  source: z.string().min(1, 'Source identifier is required'),
  sourceId: z.string().min(1, 'Source ID is required'),
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
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedTrack = z.infer<typeof ImportedTrackSchema>;

/**
 * Playlist domain model
 */
export const ImportedPlaylistSchema = z.object({
  source: z.string().min(1, 'Source identifier is required'),
  sourceId: z.string().min(1, 'Source ID is required'),
  title: z.string().min(1, 'Playlist title cannot be empty'),
  description: z.string().optional(),
  owner: z.string().optional(),
  totalTracks: z.number().int().nonnegative().optional(),
  artwork: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedPlaylist = z.infer<typeof ImportedPlaylistSchema>;

/**
 * Job status enumeration
 */
export const ImportJobStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type ImportJobStatus = z.infer<typeof ImportJobStatusSchema>;

/**
 * Import Job model
 */
export interface ImportJob {
  readonly id: string;
  readonly playlistId: string;
  readonly sourceName: string;
  readonly destinationName: string;
  readonly status: ImportJobStatus;
  readonly requestedLimit?: number;
  readonly batchSize: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly error?: ImportErrorPayload;
}

/**
 * Import Progress model
 */
export interface ImportProgress {
  readonly jobId: string;
  readonly status: ImportJobStatus;
  readonly totalExpected?: number;
  readonly processedTracks: number;
  readonly writtenTracks: number;
  readonly failedTracks: number;
  readonly currentBatch: number;
  readonly totalBatches?: number;
}
