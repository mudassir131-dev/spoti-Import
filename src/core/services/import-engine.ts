/**
 * Universal Music Import Engine - ImportEngine Service
 * Orchestrates the import lifecycle via Ports & Adapters.
 *
 * Strictly decoupled from external protocols, databases, and APIs.
 */

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
import type { MusicSource, SourceTrackPage } from '../ports/music-source.js';
import type { MusicDestination } from '../ports/music-destination.js';
import type { TrackNormalizer } from '../ports/track-normalizer.js';
import type { CheckpointStore } from '../ports/checkpoint-store.js';
import { DefaultTrackNormalizer } from './default-track-normalizer.js';

export interface ImportRequest {
  readonly playlistId: string;
  readonly limit?: number;
  readonly batchSize?: number;
  readonly signal?: AbortSignal;
  /**
   * If true, suppresses duplicate tracks by source identifier.
   * If false or omitted (default), preserves playlist order and duplicate occurrences.
   */
  readonly deduplicate?: boolean;
  /**
   * Explicit job/import ID for tracking or resuming from a checkpoint.
   */
  readonly jobId?: string;
  /**
   * Alias for jobId.
   */
  readonly importId?: string;
  /**
   * If true, forces restart of an import even if a completed checkpoint exists.
   */
  readonly forceRestart?: boolean;
}

export interface ImportExecutionOptions {
  readonly source?: MusicSource;
  readonly destination?: MusicDestination;
  readonly normalizer?: TrackNormalizer;
  readonly checkpointStore?: CheckpointStore;
  readonly throwOnError?: boolean;
  readonly onProgress?: (progress: ImportProgress) => void;
}

export interface ImportEngineConfig {
  readonly source?: MusicSource;
  readonly destination?: MusicDestination;
  readonly normalizer?: TrackNormalizer;
  readonly checkpointStore?: CheckpointStore;
  readonly defaultBatchSize?: number;
  readonly throwOnError?: boolean;
}

export interface ImportResult {
  readonly success: boolean;
  readonly job: ImportJob;
  readonly progress: ImportProgress;
  readonly isTruncated?: boolean;
  readonly error?: ImportError;
}

const ImportRequestBaseSchema = z.object({
  playlistId: z.string({
    required_error: 'playlistId is required',
    invalid_type_error: 'playlistId must be a string',
  }).trim().min(1, 'playlistId cannot be empty'),
  limit: z.number().int('limit must be an integer').positive('limit must be positive').optional(),
  batchSize: z.number().int('batchSize must be an integer').positive('batchSize must be positive').optional(),
  deduplicate: z.boolean().optional(),
  jobId: z.string().optional(),
  importId: z.string().optional(),
  forceRestart: z.boolean().optional(),
});


export class ImportEngine {
  private readonly defaultSource?: MusicSource;
  private readonly defaultDestination?: MusicDestination;
  private readonly defaultCheckpointStore?: CheckpointStore;
  private readonly normalizer: TrackNormalizer;
  private readonly defaultBatchSize: number;
  private readonly defaultThrowOnError: boolean;

  constructor(config: ImportEngineConfig = {}) {
    this.defaultSource = config.source;
    this.defaultDestination = config.destination;
    this.defaultCheckpointStore = config.checkpointStore;
    this.normalizer = config.normalizer ?? new DefaultTrackNormalizer();
    this.defaultBatchSize = config.defaultBatchSize ?? DEFAULT_BATCH_SIZE;
    this.defaultThrowOnError = config.throwOnError ?? false;
  }


  /**
   * Executes an import lifecycle.
   * If throwOnError is true (or configured as default), throws structured ImportError on failure.
   * Otherwise returns an ImportResult with success: false and the structured error.
   */
  async importPlaylist(
    request: ImportRequest,
    options: ImportExecutionOptions = {}
  ): Promise<ImportResult> {
    const shouldThrow = options.throwOnError ?? this.defaultThrowOnError;

    try {
      return await this.executeLifecycle(request, options);
    } catch (err) {
      const structuredError = this.toImportError(err);
      if (shouldThrow) {
        throw structuredError;
      }

      // Return structured failure result
      const failedJob: ImportJob = {
        id: randomUUID(),
        playlistId: typeof request?.playlistId === 'string' ? request.playlistId : 'unknown',
        sourceName: options.source?.name ?? this.defaultSource?.name ?? 'unknown',
        destinationName: options.destination?.name ?? this.defaultDestination?.name ?? 'unknown',
        status: 'failed',
        requestedLimit: request?.limit,
        batchSize: request?.batchSize ?? this.defaultBatchSize,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: structuredError.toJSON(),
      };

      const failedProgress: ImportProgress = {
        jobId: failedJob.id,
        status: 'failed',
        totalExpected: 0,
        processedTracks: 0,
        writtenTracks: 0,
        failedTracks: 0,
        currentBatch: 0,
        totalBatches: 0,
      };

      return {
        success: false,
        job: failedJob,
        progress: failedProgress,
        error: structuredError,
      };
    }
  }

  /**
   * Convenience alias that always throws structured ImportError on failure.
   */
  async importPlaylistOrThrow(
    request: ImportRequest,
    options: ImportExecutionOptions = {}
  ): Promise<ImportResult> {
    return this.importPlaylist(request, { ...options, throwOnError: true });
  }

  private async executeLifecycle(
    request: ImportRequest,
    options: ImportExecutionOptions
  ): Promise<ImportResult> {
    // 1. Validate import request
    this.validateRequest(request);

    const source = options.source ?? this.defaultSource;
    if (!source) {
      throw new ValidationError('No MusicSource configured for import engine.');
    }

    const destination = options.destination ?? this.defaultDestination;
    if (!destination) {
      throw new ValidationError('No MusicDestination configured for import engine.');
    }

    const normalizer = options.normalizer ?? this.normalizer;
    const batchSize = request.batchSize ?? this.defaultBatchSize;
    const effectiveLimit = Math.min(request.limit ?? MAX_IMPORT_TRACKS, MAX_IMPORT_TRACKS);

    // Check cancellation before job start
    if (request.signal?.aborted) {
      throw new ImportCancelledError('pre-execution', 'Import request cancelled before start');
    }

    const startTime = new Date().toISOString();
    const jobId = request.jobId ?? request.importId ?? randomUUID();
    const checkpointStore = options.checkpointStore ?? this.defaultCheckpointStore;

    // Check if an existing checkpoint exists for this importId
    let existingCheckpoint = null;
    if (checkpointStore) {
      try {
        existingCheckpoint = await checkpointStore.load(jobId);
      } catch (err) {
        console.error(`Failed to load checkpoint for ${jobId}:`, err);
      }
    }

    // If checkpoint is already completed and no forced restart requested, return completed state
    if (existingCheckpoint && existingCheckpoint.status === 'completed' && !request.forceRestart) {
      const completedJob: ImportJob = {
        id: existingCheckpoint.importId,
        playlistId: existingCheckpoint.sourceReference,
        sourceName: existingCheckpoint.sourceName,
        destinationName: destination.name,
        status: 'completed',
        requestedLimit: request.limit,
        batchSize,
        createdAt: existingCheckpoint.createdAt,
        updatedAt: existingCheckpoint.updatedAt,
        completedAt: existingCheckpoint.updatedAt,
        isTruncated: existingCheckpoint.isTruncated,
        metadata: {
          resumedFromCompleted: true,
        },
      };

      const completedProgress: ImportProgress = {
        jobId: existingCheckpoint.importId,
        status: 'completed',
        totalExpected: existingCheckpoint.processedTracks,
        totalDiscovered: existingCheckpoint.processedTracks,
        processedTracks: existingCheckpoint.processedTracks,
        writtenTracks: existingCheckpoint.writtenTracks,
        importedTracks: existingCheckpoint.writtenTracks,
        skippedTracks: existingCheckpoint.skippedTracks,
        failedTracks: existingCheckpoint.failedTracks,
        currentBatch: existingCheckpoint.currentBatch,
        currentPage: existingCheckpoint.currentPage,
        totalBatches: existingCheckpoint.currentBatch,
        isTruncated: existingCheckpoint.isTruncated,
        truncated: existingCheckpoint.isTruncated,
        percentage: 100,
      };

      options.onProgress?.(completedProgress);

      return {
        success: true,
        job: completedJob,
        progress: completedProgress,
        isTruncated: existingCheckpoint.isTruncated,
      };
    }

    const isResuming = Boolean(existingCheckpoint && existingCheckpoint.status !== 'completed');
    const resumeSkipCount = isResuming
      ? (existingCheckpoint!.processedTracks + existingCheckpoint!.skippedTracks)
      : 0;

    // 2. Create ImportJob
    let currentJob: ImportJob = {
      id: jobId,
      playlistId: request.playlistId,
      sourceName: source.name,
      destinationName: destination.name,
      status: 'running',
      requestedLimit: request.limit,
      batchSize,
      createdAt: isResuming ? existingCheckpoint!.createdAt : startTime,
      updatedAt: startTime,
    };

    let processedTracks = isResuming ? existingCheckpoint!.processedTracks : 0;
    let writtenTracks = isResuming ? existingCheckpoint!.writtenTracks : 0;
    let skippedTracks = isResuming ? existingCheckpoint!.skippedTracks : 0;
    let currentBatchNumber = isResuming ? existingCheckpoint!.currentBatch : 0;
    let committedProcessedTracks = processedTracks;
    let committedSkippedTracks = skippedTracks;
    let committedBatchNumber = currentBatchNumber;
    let lastProcessedSourceId: string | undefined = existingCheckpoint?.lastProcessedSourceId;
    let isTruncated = isResuming ? existingCheckpoint!.isTruncated : false;

    let progress: ImportProgress = {
      jobId,
      status: 'running',
      totalExpected: undefined,
      processedTracks,
      writtenTracks,
      importedTracks: writtenTracks,
      skippedTracks,
      failedTracks: 0,
      currentBatch: currentBatchNumber,
      currentPage: currentBatchNumber,
      totalBatches: undefined,
      isTruncated,
      truncated: isTruncated,
    };

    options.onProgress?.(progress);


    try {
      // 3. Fetch playlist metadata
      let playlist;
      try {
        playlist = await source.getPlaylist(request.playlistId, request.signal);
      } catch (err) {
        throw new SourceError(
          `Failed to fetch playlist '${request.playlistId}' from source '${source.name}'`,
          { sourceName: source.name, operation: 'getPlaylist', playlistId: request.playlistId },
          err
        );
      }

      if (request.signal?.aborted) {
        throw new ImportCancelledError(jobId);
      }

      const totalExpected = playlist.totalTracks;
      const initialTotalBatches =
        totalExpected !== undefined
          ? totalExpected === 0
            ? 0
            : Math.ceil(Math.min(totalExpected, effectiveLimit) / batchSize)
          : undefined;

      progress = {
        ...progress,
        totalExpected,
        totalDiscovered: totalExpected,
        totalBatches: initialTotalBatches,
      };
      options.onProgress?.(progress);

      const seenTrackIds = new Set<string>();
      let currentBatch: ImportedTrack[] = [];
      let discoveredTrackCount = 0;

      if (playlist.totalTracks !== undefined && playlist.totalTracks > effectiveLimit) {
        isTruncated = true;
      }

      const flushBatch = async (): Promise<void> => {
        if (currentBatch.length === 0) return;
        if (request.signal?.aborted) {
          throw new ImportCancelledError(jobId);
        }
        const nextBatchNumber = committedBatchNumber + 1;
        const batchToWrite = currentBatch;
        currentBatch = [];
        const batchId = `${jobId}:batch:${nextBatchNumber}`;
        const batchContext = {
          batchId,
          batchIndex: nextBatchNumber,
          trackCount: batchToWrite.length,
        };

        try {
          const writeResult = await destination.writeTracks(
            jobId,
            batchToWrite,
            request.signal,
            batchContext
          );
          await destination.commit(jobId);
          writtenTracks += writeResult.writtenCount;
          committedProcessedTracks = processedTracks;
          committedSkippedTracks = skippedTracks;
          committedBatchNumber = nextBatchNumber;
          currentBatchNumber = nextBatchNumber;
          lastProcessedSourceId = batchToWrite[batchToWrite.length - 1]?.sourceId;

          progress = {
            ...progress,
            processedTracks,
            writtenTracks,
            importedTracks: writtenTracks,
            skippedTracks,
            currentBatch: currentBatchNumber,
            currentPage: currentBatchNumber,
            isTruncated,
            truncated: isTruncated,
            percentage:
              totalExpected !== undefined && totalExpected > 0
                ? Math.min(100, Math.round((processedTracks / Math.min(totalExpected, effectiveLimit)) * 100))
                : undefined,
          };
          options.onProgress?.(progress);

          // Checkpoint safe batch boundary
          if (checkpointStore) {
            await checkpointStore.save({
              importId: jobId,
              sourceName: source.name,
              sourceReference: request.playlistId,
              processedTracks: committedProcessedTracks,
              writtenTracks,
              skippedTracks: committedSkippedTracks,
              failedTracks: 0,
              currentBatch: committedBatchNumber,
              currentPage: committedBatchNumber,
              lastProcessedSourceId,
              isTruncated,
              status: 'running',
              createdAt: currentJob.createdAt,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          throw new DestinationError(
            `Destination '${destination.name}' failed to write batch ${nextBatchNumber}`,
            {
              destinationName: destination.name,
              operation: 'writeTracks',
              batchIndex: nextBatchNumber,
              batchSize: batchToWrite.length,
            },
            err
          );
        }
      };

      // 4. Fetch tracks incrementally (Streaming or Paginated)
      if (typeof source.getTrackStream === 'function') {
        const stream = source.getTrackStream(request.playlistId, {
          limit: effectiveLimit,
          signal: request.signal,
        });

        for await (const rawTrack of stream) {
          if (request.signal?.aborted) {
            throw new ImportCancelledError(jobId);
          }

          discoveredTrackCount++;

          // If resuming, skip tracks that were already safely written in prior runs
          if (isResuming && discoveredTrackCount <= resumeSkipCount) {
            if (request.deduplicate) {
              seenTrackIds.add(rawTrack.sourceId);
            }
            continue;
          }

          if (processedTracks >= effectiveLimit) {
            isTruncated = true;
            break;
          }

          if (request.deduplicate && seenTrackIds.has(rawTrack.sourceId)) {
            skippedTracks++;
            progress = {
              ...progress,
              skippedTracks,
            };
            options.onProgress?.(progress);
            continue;
          }

          seenTrackIds.add(rawTrack.sourceId);
          const normalized = normalizer.normalize(rawTrack, processedTracks);
          currentBatch.push(normalized);
          processedTracks++;

          if (currentBatch.length >= batchSize) {
            await flushBatch();
          }
        }

        if (currentBatch.length > 0) {
          await flushBatch();
        }
      } else {
        // Fallback: paginated or single page getTracks
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore && processedTracks < effectiveLimit) {
          if (request.signal?.aborted) {
            throw new ImportCancelledError(jobId);
          }

          const fetchLimit = Math.min(effectiveLimit - processedTracks, effectiveLimit);
          let sourceTrackPage: SourceTrackPage;
          try {
            sourceTrackPage = await source.getTracks(request.playlistId, {
              limit: fetchLimit,
              cursor,
              signal: request.signal,
            });
          } catch (err) {
            throw new SourceError(
              `Failed to fetch tracks for playlist '${request.playlistId}' from source '${source.name}'`,
              { sourceName: source.name, operation: 'getTracks', playlistId: request.playlistId },
              err
            );
          }

          if (request.signal?.aborted) {
            throw new ImportCancelledError(jobId);
          }

          const rawTracks = sourceTrackPage.tracks;
          for (let i = 0; i < rawTracks.length; i++) {
            discoveredTrackCount++;

            if (isResuming && discoveredTrackCount <= resumeSkipCount) {
              if (request.deduplicate) {
                seenTrackIds.add(rawTracks[i]!.sourceId);
              }
              continue;
            }

            if (processedTracks >= effectiveLimit) {
              isTruncated = true;
              break;
            }

            const rawTrack = rawTracks[i]!;
            if (request.deduplicate && seenTrackIds.has(rawTrack.sourceId)) {
              skippedTracks++;
              progress = {
                ...progress,
                skippedTracks,
              };
              options.onProgress?.(progress);
              continue;
            }

            seenTrackIds.add(rawTrack.sourceId);
            const normalized = normalizer.normalize(rawTrack, processedTracks);
            currentBatch.push(normalized);
            processedTracks++;

            if (currentBatch.length >= batchSize) {
              await flushBatch();
            }
          }

          cursor = sourceTrackPage.nextCursor;
          hasMore = sourceTrackPage.hasMore && Boolean(cursor);

          if (sourceTrackPage.total !== undefined && sourceTrackPage.total > effectiveLimit) {
            isTruncated = true;
          }
        }

        if (currentBatch.length > 0) {
          await flushBatch();
        }
      }

      // 5. Commit written batches (or empty playlist commit)
      if (currentBatchNumber === 0) {
        await destination.commit(jobId);
      } else {
        try {
          await destination.commit(jobId);
        } catch (err) {
          throw new DestinationError(
            `Destination '${destination.name}' failed during transaction commit`,
            { destinationName: destination.name, operation: 'commit' },
            err
          );
        }
      }

      // 6 & 7. Update ImportProgress and finish successfully
      const completionTime = new Date().toISOString();
      const finalTotalBatches =
        currentBatchNumber > 0
          ? currentBatchNumber
          : initialTotalBatches !== undefined
            ? initialTotalBatches
            : 0;

      currentJob = {
        ...currentJob,
        status: 'completed',
        updatedAt: completionTime,
        completedAt: completionTime,
        isTruncated,
        metadata: {
          truncated: isTruncated,
          totalDiscovered: totalExpected,
          maxImportCeiling: MAX_IMPORT_TRACKS,
          resumed: isResuming,
        },
      };

      progress = {
        ...progress,
        status: 'completed',
        processedTracks,
        writtenTracks,
        importedTracks: writtenTracks,
        skippedTracks,
        totalBatches: finalTotalBatches,
        currentBatch: currentBatchNumber,
        currentPage: currentBatchNumber,
        isTruncated,
        truncated: isTruncated,
        percentage:
          totalExpected !== undefined && totalExpected > 0
            ? Math.min(100, Math.round((processedTracks / Math.min(totalExpected, effectiveLimit)) * 100))
            : undefined,
      };
      options.onProgress?.(progress);

      // Checkpoint completion
      if (checkpointStore) {
        await checkpointStore.save({
          importId: jobId,
          sourceName: source.name,
          sourceReference: request.playlistId,
          processedTracks,
          writtenTracks,
          skippedTracks,
          failedTracks: 0,
          currentBatch: currentBatchNumber,
          currentPage: currentBatchNumber,
          isTruncated,
          status: 'completed',
          createdAt: currentJob.createdAt,
          updatedAt: completionTime,
        });
      }

      return {
        success: true,
        job: currentJob,
        progress,
        isTruncated,
      };
    } catch (err) {
      const error = this.toImportError(err);

      // Rollback destination changes when an error occurs
      try {
        await destination.rollback(jobId, error);
      } catch (rollbackErr) {
        console.error(`Rollback failed for job ${jobId}:`, rollbackErr);
      }

      const failTime = new Date().toISOString();
      currentJob = {
        ...currentJob,
        status: 'failed',
        updatedAt: failTime,
        completedAt: failTime,
        error: error.toJSON(),
      };

      progress = {
        ...progress,
        status: 'failed',
      };
      options.onProgress?.(progress);

      // Checkpoint failure state
      if (checkpointStore && source) {
        try {
          await checkpointStore.save({
            importId: jobId,
            sourceName: source.name,
            sourceReference: request.playlistId,
            processedTracks: committedProcessedTracks,
            writtenTracks,
            skippedTracks: committedSkippedTracks,
            failedTracks: 0,
            currentBatch: committedBatchNumber,
            currentPage: committedBatchNumber,
            lastProcessedSourceId,
            isTruncated,
            status: 'failed',
            createdAt: currentJob?.createdAt ?? failTime,
            updatedAt: failTime,
          });
        } catch (cpErr) {
          console.error(`Failed to save failure checkpoint for ${jobId}:`, cpErr);
        }
      }

      const shouldThrow = options.throwOnError ?? this.defaultThrowOnError;
      if (shouldThrow) {
        throw error;
      }

      return {
        success: false,
        job: currentJob,
        progress,
        error,
      };
    }

  }

  private validateRequest(request: ImportRequest): void {
    if (!request || typeof request !== 'object') {
      throw new ValidationError('Import request must be an object');
    }

    // Safety limit check - strictly enforces MAX_IMPORT_TRACKS
    if (typeof request.limit === 'number' && request.limit > MAX_IMPORT_TRACKS) {
      throw new ImportLimitError(request.limit, MAX_IMPORT_TRACKS);
    }

    const validationResult = ImportRequestBaseSchema.safeParse(request);
    if (!validationResult.success) {
      const message = validationResult.error.issues.map((i) => i.message).join(', ');
      throw new ValidationError(`Invalid import request: ${message}`, {
        issues: validationResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    if (typeof request.batchSize === 'number' && request.batchSize > MAX_IMPORT_TRACKS) {
      throw new ValidationError(`batchSize cannot exceed MAX_IMPORT_TRACKS (${MAX_IMPORT_TRACKS})`);
    }
  }


  private toImportError(err: unknown): ImportError {
    if (err instanceof ImportError) {
      return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    return new ValidationError(`Unexpected execution error: ${message}`, {}, err);
  }
}
