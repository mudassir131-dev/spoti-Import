/**
 * Universal Music Import Engine - CheckpointStore Port
 *
 * Generic abstraction for persistence of import progress checkpoints.
 * Completely decoupled from database technologies (Postgres, Room, SQLite, Filesystem, Memory).
 */

import type { ImportCheckpoint } from '../domain/models.js';

export interface CheckpointStore {
  /**
   * Persists or updates an import checkpoint atomically.
   */
  save(checkpoint: ImportCheckpoint): Promise<void>;

  /**
   * Retrieves an active checkpoint by its import ID.
   * Returns null if no checkpoint exists for the given ID.
   */
  load(importId: string): Promise<ImportCheckpoint | null>;

  /**
   * Deletes or cleans up an import checkpoint upon final completion or purge.
   */
  delete(importId: string): Promise<void>;
}
