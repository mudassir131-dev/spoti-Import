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

export interface MusicDestination {
  /**
   * Unique identifier or human-readable name of the destination adapter (e.g. "mock-dest", "room-sqlite")
   */
  readonly name: string;

  /**
   * Persists a batch of normalized tracks for the active import job
   */
  writeTracks(
    jobId: string,
    tracks: readonly ImportedTrack[],
    signal?: AbortSignal
  ): Promise<WriteTracksResult>;

  /**
   * Commits the transaction or finalized state for the given import job
   */
  commit(jobId: string): Promise<void>;

  /**
   * Rolls back any uncommitted changes for the given import job when an error or cancellation occurs
   */
  rollback(jobId: string, cause?: unknown): Promise<void>;
}
