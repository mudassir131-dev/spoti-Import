/**
 * In-Memory CheckpointStore Adapter
 * Reference in-memory store for unit tests, offline simulation, and decoupled execution.
 */

import type { CheckpointStore } from '../../core/ports/checkpoint-store.js';
import {
  type ImportCheckpoint,
  ImportCheckpointSchema,
} from '../../core/domain/models.js';

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly store = new Map<string, ImportCheckpoint>();

  /**
   * Persists or updates an import checkpoint.
   * Clones to guarantee immutability across caller reference mutations.
   */
  async save(checkpoint: ImportCheckpoint): Promise<void> {
    const validated = ImportCheckpointSchema.parse(checkpoint);
    // Deep-clone to preserve pristine snapshot semantics
    this.store.set(validated.importId, JSON.parse(JSON.stringify(validated)));
  }

  /**
   * Retrieves an active checkpoint by its import ID.
   * Returns a detached clone or null if missing.
   */
  async load(importId: string): Promise<ImportCheckpoint | null> {
    const item = this.store.get(importId);
    if (!item) {
      return null;
    }
    return JSON.parse(JSON.stringify(item));
  }

  /**
   * Deletes a checkpoint by import ID.
   */
  async delete(importId: string): Promise<void> {
    this.store.delete(importId);
  }

  /**
   * Diagnostic helper for test assertions.
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Diagnostic helper to inspect all active checkpoint keys.
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Resets all stored checkpoints.
   */
  clear(): void {
    this.store.clear();
  }
}
