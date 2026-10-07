import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { MAX_IMPORT_TRACKS, DEFAULT_BATCH_SIZE } from '../domain/constants.js';
import {
  ImportError,
  ValidationError,
  SourceError,
  DestinationError,
  ImportLimitError,
  ImportCancelledError,
} from '../domain/errors.js';
import {
  type ImportJob,
  type ImportProgress,
  type ImportedTrack,
} from '../domain/models.js';
import type { MusicSource } from '../ports/music-source.js';
import type { MusicDestination } from '../ports/music-destination.js';
import type { TrackNormalizer } from '../ports/track-normalizer.js';
import { DefaultTrackNormalizer } from './default-track-normalizer.js';

export interface ImportRequest {
  readonly playlistId: string;
  readonly limit?: number;
  readonly batchSize?: number;
  readonly signal?: AbortSignal;
}

export interface ImportExecutionOptions {
  readonly source?: MusicSource;
  readonly destination?: MusicDestination;
  readonly normalizer?: TrackNormalizer;
  readonly throwOnError?: boolean;
  readonly onProgress?: (progress: ImportProgress) => void;
}

export interface ImportEngineConfig {
  readonly source?: MusicSource;
  readonly destination?: MusicDestination;
  readonly normalizer?: TrackNormalizer;
  readonly defaultBatchSize?: number;
  readonly throwOnError?: boolean;
}

export interface ImportResult {
  readonly success: boolean;
  readonly job: ImportJob;
  readonly progress: ImportProgress;
  readonly error?: ImportError;
}

const ImportRequestBaseSchema = z.object({
  playlistId: z.string({
    required_error: 'playlistId is required',
    invalid_type_error: 'playlistId must be a string',
  }).trim().min(1, 'playlistId cannot be empty'),
  limit: z.number().int('limit must be an integer').positive('limit must be positive').optional(),
  batchSize: z.number().int('batchSize must be an integer').positive('batchSize must be positive').optional(),
});
