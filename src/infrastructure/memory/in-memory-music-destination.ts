/**
 * In-Memory MusicDestination Adapter
 * Used for testing, offline simulation, and reference implementation of MusicDestination port.
 */

import type {
  MusicDestination,
  WriteTracksResult,
  WriteBatchContext,
  ImportMetadata,
} from '../../core/ports/music-destination.js';
import type { ImportedTrack, ExportResult } from '../../core/domain/models.js';

export class InMemoryMusicDestination implements MusicDestination {
  readonly name: string;
  readonly committedJobs = new Set<string>();
  readonly rolledBackJobs = new Set<string>();
  readonly tracksByJob = new Map<string, ImportedTrack[]>();
  readonly metadataByJob = new Map<string, ImportMetadata>();
  readonly exportResultByJob = new Map<string, ExportResult>();
  private readonly uncommittedBatches = new Map<string, ImportedTrack[]>();
  private readonly committedBatchIds = new Map<string, Set<string>>();
  private readonly uncommittedBatchIds = new Map<string, Set<string>>();

  constructor(name = 'in-memory-destination') {
    this.name = name;
  }

  async initialize(metadata: ImportMetadata): Promise<void> {
    this.metadataByJob.set(metadata.importId, metadata);
  }


  async hasBatch(jobId: string, batchId: string): Promise<boolean> {
    return (
      this.committedBatchIds.get(jobId)?.has(batchId) === true ||
      this.uncommittedBatchIds.get(jobId)?.has(batchId) === true
    );
  }

  async writeTracks(
    jobId: string,
    tracks: readonly ImportedTrack[],
    _signal?: AbortSignal,
    context?: WriteBatchContext
  ): Promise<WriteTracksResult> {
    if (context?.batchId) {
      if (await this.hasBatch(jobId, context.batchId)) {
        // Idempotency: batch already received/written for this job
        return { writtenCount: 0 };
      }
      const batchSet = this.uncommittedBatchIds.get(jobId) ?? new Set<string>();
      batchSet.add(context.batchId);
      this.uncommittedBatchIds.set(jobId, batchSet);
    }

    const existing = this.uncommittedBatches.get(jobId) ?? [];
    existing.push(...tracks);
    this.uncommittedBatches.set(jobId, existing);
    return { writtenCount: tracks.length };
  }

  async commit(jobId: string): Promise<void> {
    const uncommitted = this.uncommittedBatches.get(jobId) ?? [];
    const existingCommitted = this.tracksByJob.get(jobId) ?? [];
    existingCommitted.push(...uncommitted);
    this.tracksByJob.set(jobId, existingCommitted);
    this.uncommittedBatches.delete(jobId);

    // Commit batch IDs
    const uncommittedBatchSet = this.uncommittedBatchIds.get(jobId);
    if (uncommittedBatchSet) {
      const committedSet = this.committedBatchIds.get(jobId) ?? new Set<string>();
      for (const bId of uncommittedBatchSet) {
        committedSet.add(bId);
      }
      this.committedBatchIds.set(jobId, committedSet);
      this.uncommittedBatchIds.delete(jobId);
    }

    this.committedJobs.add(jobId);
  }

  async rollback(jobId: string, _cause?: unknown): Promise<void> {
    this.uncommittedBatches.delete(jobId);
    this.uncommittedBatchIds.delete(jobId);
    this.rolledBackJobs.add(jobId);
  }

  getCommittedTracks(jobId: string): readonly ImportedTrack[] {
    return this.tracksByJob.get(jobId) ?? [];
  }

  async complete(jobId: string, summary?: Partial<ExportResult>): Promise<ExportResult> {
    const tracks = this.tracksByJob.get(jobId) ?? [];
    const meta = this.metadataByJob.get(jobId);
    const result: ExportResult = {
      format: summary?.format ?? 'memory',
      importId: jobId,
      destinationName: this.name,
      trackCount: summary?.trackCount ?? tracks.length,
      writtenCount: summary?.writtenCount ?? tracks.length,
      skippedCount: summary?.skippedCount ?? 0,
      failedCount: summary?.failedCount ?? 0,
      isTruncated: summary?.isTruncated ?? false,
      schemaVersion: summary?.schemaVersion ?? 1,
      createdAt: meta?.createdAt ?? summary?.createdAt ?? new Date().toISOString(),
      completedAt: summary?.completedAt ?? new Date().toISOString(),
      metadata: summary?.metadata,
    };
    this.exportResultByJob.set(jobId, result);
    return result;
  }

  async getExportResult(jobId: string): Promise<ExportResult | null> {
    return this.exportResultByJob.get(jobId) ?? null;
  }
}


