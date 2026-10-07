/**
 * In-Memory MusicDestination Adapter
 * Used for testing, offline simulation, and reference implementation of MusicDestination port.
 */

import type { MusicDestination, WriteTracksResult } from '../../core/ports/music-destination.js';
import type { ImportedTrack } from '../../core/domain/models.js';

export class InMemoryMusicDestination implements MusicDestination {
  readonly name: string;
  readonly committedJobs = new Set<string>();
  readonly rolledBackJobs = new Set<string>();
  readonly tracksByJob = new Map<string, ImportedTrack[]>();
  private readonly uncommittedBatches = new Map<string, ImportedTrack[]>();

  constructor(name = 'in-memory-destination') {
    this.name = name;
  }

  async writeTracks(jobId: string, tracks: readonly ImportedTrack[]): Promise<WriteTracksResult> {
    const existing = this.uncommittedBatches.get(jobId) ?? [];
    existing.push(...tracks);
    this.uncommittedBatches.set(jobId, existing);
    return { writtenCount: tracks.length };
  }

  async commit(jobId: string): Promise<void> {
    const uncommitted = this.uncommittedBatches.get(jobId) ?? [];
    this.tracksByJob.set(jobId, uncommitted);
    this.uncommittedBatches.delete(jobId);
    this.committedJobs.add(jobId);
  }

  async rollback(jobId: string, _cause?: unknown): Promise<void> {
    this.uncommittedBatches.delete(jobId);
    this.rolledBackJobs.add(jobId);
  }

  getCommittedTracks(jobId: string): readonly ImportedTrack[] {
    return this.tracksByJob.get(jobId) ?? [];
  }
}
