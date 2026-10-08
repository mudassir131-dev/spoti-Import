/**
 * Universal Music Import Engine - In-Memory ImportManifestStore
 * Reference implementation of the ImportManifestStore port.
 */

import type { ImportManifestStore } from '../../core/ports/manifest-store.js';
import type { ImportManifest } from '../../core/domain/models.js';

export class InMemoryImportManifestStore implements ImportManifestStore {
  private readonly manifests = new Map<string, ImportManifest>();

  async save(manifest: ImportManifest): Promise<void> {
    // Deep clone to guarantee immutability and caller mutation isolation
    this.manifests.set(manifest.importId, JSON.parse(JSON.stringify(manifest)));
  }

  async load(importId: string): Promise<ImportManifest | null> {
    const found = this.manifests.get(importId);
    if (!found) return null;
    return JSON.parse(JSON.stringify(found));
  }

  async list(): Promise<readonly ImportManifest[]> {
    return Array.from(this.manifests.values()).map((m) => JSON.parse(JSON.stringify(m)));
  }

  async delete(importId: string): Promise<void> {
    this.manifests.delete(importId);
  }

  clear(): void {
    this.manifests.clear();
  }
}
