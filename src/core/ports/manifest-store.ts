/**
 * Universal Music Import Engine - ImportManifestStore Port
 *
 * Generic persistence abstraction for versioned import audit manifests.
 * Decoupled from any database engine.
 */

import type { ImportManifest } from '../domain/models.js';

export interface ImportManifestStore {
  /**
   * Persists or updates an import manifest.
   */
  save(manifest: ImportManifest): Promise<void>;

  /**
   * Retrieves an import manifest by import ID.
   * Returns null if no manifest exists.
   */
  load(importId: string): Promise<ImportManifest | null>;

  /**
   * Optional method to list all recorded manifests.
   */
  list?(): Promise<readonly ImportManifest[]>;

  /**
   * Optional method to delete/purge a manifest.
   */
  delete?(importId: string): Promise<void>;
}
