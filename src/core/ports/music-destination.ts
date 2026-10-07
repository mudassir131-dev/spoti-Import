/**
 * Universal Music Import Engine - MusicDestination Port
 * Generic abstraction for persistence/target sinks (Memory, Room SQLite, Postgres, Filesystem, etc.)
 */

import type { ImportedTrack } from '../domain/models.js';

export interface WriteTracksResult {
  /**
   * Number of tracks successfully persisted in this write call
   */
  readonly writtenCount: number;
}

export interface WriteBatchContext {
  /**
   * Deterministic, idempotent batch identifier (e.g. `${jobId}:batch:${batchIndex}`).
   */
  readonly batchId: string;

  /**
   * 1-based sequential batch index within the import job.
   */
  readonly batchIndex: number;

  /**
   * Total number of tracks in this batch.
   */
  readonly trackCount: number;

  /**
   * Optional flag indicating if this is known to be the final batch of the import.
   */
  readonly isFinalBatch?: boolean;
}

export interface MusicDestination {
  /**
   * Unique identifier or human-readable name of the destination adapter (e.g. "mock-dest", "room-sqlite")
   */
  readonly name: string;

  /**
   * Persists a batch of normalized tracks for the active import job.
   * Optional context provides deterministic batch identity for idempotency.
   */
  writeTracks(
    jobId: string,
    tracks: readonly ImportedTrack[],
    signal?: AbortSignal,
    context?: WriteBatchContext
  ): Promise<WriteTracksResult>;

  /**
   * Commits the transaction or finalized state for the given import job
   */
  commit(jobId: string): Promise<void>;

  /**
   * Rolls back any uncommitted changes for the given import job when an error or cancellation occurs
   */
  rollback(jobId: string, cause?: unknown): Promise<void>;

  /**
   * Optional check if a deterministic batch has already been persisted for this job.
   */
  hasBatch?(jobId: string, batchId: string): Promise<boolean>;
}
