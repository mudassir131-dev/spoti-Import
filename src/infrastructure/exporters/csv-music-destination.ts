/**
 * Universal Music Import Engine - CSV MusicDestination Adapter
 * High-performance, RFC 4180 compliant streaming CSV exporter.
 *
 * Implements the MusicDestination port, supporting incremental batch writing,
 * strict RFC 4180 quote escaping, Unicode handling, and credential safety.
 */

import { CURRENT_SCHEMA_VERSION } from '../../core/domain/constants.js';
import type { ImportedTrack, ExportResult } from '../../core/domain/models.js';
import type {
  MusicDestination,
  WriteTracksResult,
  WriteBatchContext,
  ImportMetadata,
} from '../../core/ports/music-destination.js';

export const CSV_COLUMNS = [
  'source',
  'sourceId',
  'title',
  'artists',
  'album',
  'albumArtist',
  'durationMs',
  'isrc',
  'trackNumber',
  'discNumber',
  'explicit',
  'artwork',
] as const;

export const CSV_HEADER = CSV_COLUMNS.join(',') + '\r\n';

export interface CsvDestinationOptions {
  /**
   * Adapter name (default: 'csv-exporter')
   */
  readonly name?: string;

  /**
   * Optional streaming chunk sink.
   * Delivers CSV chunks incrementally per batch.
   */
  readonly writeChunk?: (chunk: string) => Promise<void> | void;

  /**
   * If true, avoids keeping serialized CSV chunks in memory when writeChunk is active.
   */
  readonly streamOnly?: boolean;
}

interface CsvJobSession {
  readonly jobId: string;
  metadata?: ImportMetadata;
  writtenCount: number;
  headerWritten: boolean;
  isRolledBack: boolean;
  uncommittedChunks: string[];
  committedChunks: string[];
  uncommittedTrackCount: number;
  exportResult?: ExportResult;
}

/**
 * Escapes a single CSV field in compliance with RFC 4180.
 * If the value contains commas, quotes, CRLF, or newlines, it is enclosed in double quotes,
 * and any internal quotes are doubled ("").
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Deterministically formats an ImportedTrack into an RFC 4180 CSV row.
 */
export function formatTrackCsvRow(track: ImportedTrack): string {
  const artistsStr = track.artists.map((a) => a.name).join('; ');
  const albumStr = track.album?.title ?? '';
  const albumArtistStr = track.albumArtist ?? '';
  const durationStr = track.durationMs !== undefined ? String(track.durationMs) : '';
  const isrcStr = track.isrc ?? '';
  const trackNumStr = track.trackNumber !== undefined ? String(track.trackNumber) : '';
  const discNumStr = track.discNumber !== undefined ? String(track.discNumber) : '';
  const explicitStr = track.explicit !== undefined ? (track.explicit ? 'true' : 'false') : '';
  const artworkStr = track.artwork ?? track.album?.artwork ?? '';

  const fields = [
    escapeCsvField(track.source),
    escapeCsvField(track.sourceId),
    escapeCsvField(track.title),
    escapeCsvField(artistsStr),
    escapeCsvField(albumStr),
    escapeCsvField(albumArtistStr),
    escapeCsvField(durationStr),
    escapeCsvField(isrcStr),
    escapeCsvField(trackNumStr),
    escapeCsvField(discNumStr),
    escapeCsvField(explicitStr),
    escapeCsvField(artworkStr),
  ];

  return fields.join(',') + '\r\n';
}

export class CsvMusicDestination implements MusicDestination {
  readonly name: string;
  private readonly writeChunkCallback?: (chunk: string) => Promise<void> | void;
  private readonly streamOnly: boolean;
  private readonly sessions = new Map<string, CsvJobSession>();
  private readonly committedBatchIds = new Map<string, Set<string>>();
  private readonly uncommittedBatchIds = new Map<string, Set<string>>();

  constructor(options: CsvDestinationOptions = {}) {
    this.name = options.name ?? 'csv-exporter';
    this.writeChunkCallback = options.writeChunk;
    this.streamOnly = options.streamOnly ?? false;
  }

  private getOrCreateSession(jobId: string): CsvJobSession {
    let session = this.sessions.get(jobId);
    if (!session) {
      session = {
        jobId,
        writtenCount: 0,
        headerWritten: false,
        isRolledBack: false,
        uncommittedChunks: [],
        committedChunks: [],
        uncommittedTrackCount: 0,
      };
      this.sessions.set(jobId, session);
    }
    return session;
  }

  async initialize(metadata: ImportMetadata): Promise<void> {
    const session = this.getOrCreateSession(metadata.importId);
    session.metadata = metadata;

    if (!session.headerWritten) {
      session.committedChunks.push(CSV_HEADER);
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(CSV_HEADER);
      }
      session.headerWritten = true;
    }
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
    signal?: AbortSignal,
    context?: WriteBatchContext
  ): Promise<WriteTracksResult> {
    if (signal?.aborted) {
      throw new Error(`Write operation aborted for job '${jobId}'`);
    }

    const session = this.getOrCreateSession(jobId);

    // Idempotency: skip if already persisted
    if (context?.batchId) {
      if (await this.hasBatch(jobId, context.batchId)) {
        return { writtenCount: 0 };
      }
      const batchSet = this.uncommittedBatchIds.get(jobId) ?? new Set<string>();
      batchSet.add(context.batchId);
      this.uncommittedBatchIds.set(jobId, batchSet);
    }

    // Lazy write header if initialize was not called
    if (!session.headerWritten) {
      session.committedChunks.push(CSV_HEADER);
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(CSV_HEADER);
      }
      session.headerWritten = true;
    }

    if (tracks.length === 0) {
      return { writtenCount: 0 };
    }

    const chunks: string[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (signal?.aborted) {
        throw new Error(`Write operation aborted for job '${jobId}' during track serialization`);
      }
      chunks.push(formatTrackCsvRow(tracks[i]!));
    }

    session.uncommittedChunks.push(...chunks);
    session.uncommittedTrackCount += tracks.length;

    return { writtenCount: tracks.length };
  }

  async commit(jobId: string): Promise<void> {
    const session = this.sessions.get(jobId);
    if (!session) return;

    if (session.uncommittedChunks.length > 0) {
      const batchPayload = session.uncommittedChunks.join('');
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(batchPayload);
      }
      if (!this.streamOnly) {
        session.committedChunks.push(batchPayload);
      }
      session.uncommittedChunks = [];
      session.writtenCount += session.uncommittedTrackCount;
      session.uncommittedTrackCount = 0;
    }

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
  }

  async rollback(jobId: string, _cause?: unknown): Promise<void> {
    const session = this.sessions.get(jobId);
    if (!session) return;

    session.uncommittedChunks = [];
    session.uncommittedTrackCount = 0;
    session.isRolledBack = true;
    this.uncommittedBatchIds.delete(jobId);
  }

  async complete(jobId: string, summary?: Partial<ExportResult>): Promise<ExportResult> {
    const session = this.getOrCreateSession(jobId);

    // Commit any remaining uncommitted rows
    await this.commit(jobId);

    // Ensure header was written even for empty imports
    if (!session.headerWritten) {
      session.committedChunks.push(CSV_HEADER);
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(CSV_HEADER);
      }
      session.headerWritten = true;
    }

    const exportResult: ExportResult = {
      format: 'csv',
      importId: jobId,
      destinationName: this.name,
      trackCount: summary?.trackCount ?? session.writtenCount,
      writtenCount: summary?.writtenCount ?? session.writtenCount,
      skippedCount: summary?.skippedCount ?? 0,
      failedCount: summary?.failedCount ?? 0,
      isTruncated: summary?.isTruncated ?? false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: session.metadata?.createdAt ?? summary?.createdAt ?? new Date().toISOString(),
      completedAt: summary?.completedAt ?? new Date().toISOString(),
      metadata: summary?.metadata,
    };

    session.exportResult = exportResult;
    return exportResult;
  }

  async getExportResult(jobId: string): Promise<ExportResult | null> {
    return this.sessions.get(jobId)?.exportResult ?? null;
  }

  getCsvString(jobId: string): string {
    const session = this.sessions.get(jobId);
    if (!session) {
      throw new Error(`No CSV export found for job '${jobId}'`);
    }
    if (this.streamOnly) {
      throw new Error(`getCsvString is disabled when streamOnly is enabled for '${jobId}'`);
    }
    return session.committedChunks.join('');
  }
}
