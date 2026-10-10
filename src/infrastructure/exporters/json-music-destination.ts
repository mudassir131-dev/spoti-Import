/**
 * Universal Music Import Engine - JSON MusicDestination Adapter
 * High-performance, deterministic streaming JSON exporter.
 *
 * Implements the MusicDestination port, supporting incremental writing,
 * strictly bounded memory consumption, and complete credential exclusion.
 */

import { CURRENT_SCHEMA_VERSION } from '../../core/domain/constants.js';
import type { ImportedTrack, ExportResult } from '../../core/domain/models.js';
import type {
  MusicDestination,
  WriteTracksResult,
  WriteBatchContext,
  ImportMetadata,
} from '../../core/ports/music-destination.js';

export interface JsonDestinationOptions {
  /**
   * Adapter name (default: 'json-exporter')
   */
  readonly name?: string;

  /**
   * If true, formats the JSON with indentation (2 spaces). Default: false (compact deterministic).
   */
  readonly pretty?: boolean;

  /**
   * Optional streaming chunk sink.
   * Chunks are delivered incrementally per batch, allowing unbounded playlist export
   * with minimal memory footprint.
   */
  readonly writeChunk?: (chunk: string) => Promise<void> | void;

  /**
   * If true and writeChunk is provided, avoids retaining chunks in memory.
   * Default: false (retains for getJsonString / getParsedJson).
   */
  readonly streamOnly?: boolean;
}

interface JsonJobSession {
  readonly jobId: string;
  metadata?: ImportMetadata;
  trackCount: number;
  writtenCount: number;
  firstTrackWritten: boolean;
  headerWritten: boolean;
  footerWritten: boolean;
  isRolledBack: boolean;
  uncommittedChunks: string[];
  committedChunks: string[];
  uncommittedTrackCount: number;
  exportResult?: ExportResult;
}

const SENSITIVE_KEY_PATTERN = /(token|secret|password|auth|key|credential)/i;

/**
 * Removes sensitive keys from arbitrary metadata objects
 */
function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Sanitizes an ImportedTrack to guarantee no accidental secrets are serialized
 */
function sanitizeTrack(track: ImportedTrack): ImportedTrack {
  const cleanTrack: ImportedTrack = {
    source: track.source,
    sourceId: track.sourceId,
    title: track.title,
    artists: track.artists.map((a) => ({
      name: a.name,
      ...(a.sourceId ? { sourceId: a.sourceId } : {}),
      ...(a.roles ? { roles: a.roles } : {}),
      ...(a.metadata ? { metadata: sanitizeMetadata(a.metadata) } : {}),
    })),
  };

  if (track.album) {
    cleanTrack.album = {
      title: track.album.title,
      ...(track.album.sourceId ? { sourceId: track.album.sourceId } : {}),
      ...(track.album.releaseDate ? { releaseDate: track.album.releaseDate } : {}),
      ...(track.album.totalTracks !== undefined ? { totalTracks: track.album.totalTracks } : {}),
      ...(track.album.artists ? { artists: track.album.artists } : {}),
      ...(track.album.artwork ? { artwork: track.album.artwork } : {}),
      ...(track.album.metadata ? { metadata: sanitizeMetadata(track.album.metadata) } : {}),
    };
  }

  if (track.albumArtist !== undefined) cleanTrack.albumArtist = track.albumArtist;
  if (track.durationMs !== undefined) cleanTrack.durationMs = track.durationMs;
  if (track.isrc !== undefined) cleanTrack.isrc = track.isrc;
  if (track.trackNumber !== undefined) cleanTrack.trackNumber = track.trackNumber;
  if (track.discNumber !== undefined) cleanTrack.discNumber = track.discNumber;
  if (track.explicit !== undefined) cleanTrack.explicit = track.explicit;
  if (track.artwork !== undefined) cleanTrack.artwork = track.artwork;
  if (track.position !== undefined) cleanTrack.position = track.position;
  if (track.occurrenceId !== undefined) cleanTrack.occurrenceId = track.occurrenceId;
  if (track.addedAt !== undefined) cleanTrack.addedAt = track.addedAt;
  if (track.metadata) cleanTrack.metadata = sanitizeMetadata(track.metadata);

  return cleanTrack;
}

export class JsonMusicDestination implements MusicDestination {
  readonly name: string;
  private readonly pretty: boolean;
  private readonly writeChunkCallback?: (chunk: string) => Promise<void> | void;
  private readonly streamOnly: boolean;
  private readonly sessions = new Map<string, JsonJobSession>();
  private readonly committedBatchIds = new Map<string, Set<string>>();
  private readonly uncommittedBatchIds = new Map<string, Set<string>>();

  constructor(options: JsonDestinationOptions = {}) {
    this.name = options.name ?? 'json-exporter';
    this.pretty = options.pretty ?? false;
    this.writeChunkCallback = options.writeChunk;
    this.streamOnly = options.streamOnly ?? false;
  }

  private getOrCreateSession(jobId: string): JsonJobSession {
    let session = this.sessions.get(jobId);
    if (!session) {
      session = {
        jobId,
        trackCount: 0,
        writtenCount: 0,
        firstTrackWritten: false,
        headerWritten: false,
        footerWritten: false,
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
      const headerChunk = this.formatHeader(metadata);
      session.committedChunks.push(headerChunk);
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(headerChunk);
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

    // Lazy write header if initialize was not explicitly called
    if (!session.headerWritten) {
      const headerChunk = this.formatHeader(
        session.metadata ?? {
          importId: jobId,
          playlistId: 'unknown',
          sourceName: 'unknown',
          createdAt: new Date().toISOString(),
        }
      );
      session.committedChunks.push(headerChunk);
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(headerChunk);
      }
      session.headerWritten = true;
    }

    if (tracks.length === 0) {
      return { writtenCount: 0 };
    }

    const chunks: string[] = [];
    const indent = this.pretty ? '    ' : '';
    const newline = this.pretty ? '\n' : '';

    for (let i = 0; i < tracks.length; i++) {
      if (signal?.aborted) {
        throw new Error(`Write operation aborted for job '${jobId}' during track serialization`);
      }
      const rawTrack = tracks[i]!;
      const position = rawTrack.position ?? session.trackCount;
      const occurrenceId = rawTrack.occurrenceId ?? `occ_${position}`;
      const trackWithOccurrence: ImportedTrack = {
        ...rawTrack,
        position,
        occurrenceId,
      };
      session.trackCount++;
      const track = sanitizeTrack(trackWithOccurrence);
      const prefix = session.firstTrackWritten ? `,${newline}${indent}` : `${newline}${indent}`;
      const serialized = this.pretty
        ? JSON.stringify(track, null, 2)
            .split('\n')
            .map((line, idx) => (idx === 0 ? line : `    ${line}`))
            .join('\n')
        : JSON.stringify(track);

      chunks.push(`${prefix}${serialized}`);
      session.firstTrackWritten = true;
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

    session.trackCount = Math.max(0, session.trackCount - session.uncommittedTrackCount);
    session.uncommittedChunks = [];
    session.uncommittedTrackCount = 0;
    session.isRolledBack = true;
    this.uncommittedBatchIds.delete(jobId);
  }

  async complete(jobId: string, summary?: Partial<ExportResult>): Promise<ExportResult> {
    const session = this.getOrCreateSession(jobId);

    // Commit any uncommitted residue
    await this.commit(jobId);

    if (!session.footerWritten) {
      const footerChunk = this.formatFooter(session, summary);
      if (this.writeChunkCallback) {
        await this.writeChunkCallback(footerChunk);
      }
      if (!this.streamOnly) {
        session.committedChunks.push(footerChunk);
      }
      session.footerWritten = true;
    }

    const exportResult: ExportResult = {
      format: 'json',
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

  getJsonString(jobId: string): string {
    const session = this.sessions.get(jobId);
    if (!session) {
      throw new Error(`No JSON export found for job '${jobId}'`);
    }
    if (this.streamOnly) {
      throw new Error(`getJsonString is disabled when streamOnly is enabled for '${jobId}'`);
    }
    return session.committedChunks.join('');
  }

  getParsedJson<T = unknown>(jobId: string): T {
    const jsonStr = this.getJsonString(jobId);
    return JSON.parse(jsonStr) as T;
  }

  private formatHeader(metadata: ImportMetadata): string {
    const meta = metadata.metadata ? sanitizeMetadata(metadata.metadata) : undefined;
    const playlistObj: Record<string, unknown> = {
      id: metadata.playlistId,
      name: metadata.playlistTitle ?? metadata.playlistId,
      ...(metadata.description ? { description: metadata.description } : {}),
      ...(metadata.owner ? { owner: metadata.owner } : {}),
      ...(metadata.totalTracks !== undefined ? { totalTracks: metadata.totalTracks } : {}),
      ...(meta ? { metadata: meta } : {}),
    };

    if (this.pretty) {
      const topLevel = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        source: metadata.sourceName,
        importId: metadata.importId,
        playlist: playlistObj,
      };
      const formatted = JSON.stringify(topLevel, null, 2);
      // Remove closing brace and append comma + tracks property
      const trimmed = formatted.substring(0, formatted.lastIndexOf('}')).trimEnd();
      return `${trimmed},\n  "tracks": [`;
    }

    return `{"schemaVersion":${CURRENT_SCHEMA_VERSION},"source":${JSON.stringify(
      metadata.sourceName
    )},"importId":${JSON.stringify(metadata.importId)},"playlist":${JSON.stringify(
      playlistObj
    )},"tracks":[`;
  }

  private formatFooter(session: JsonJobSession, summary?: Partial<ExportResult>): string {
    const isTruncated = summary?.isTruncated ?? false;
    const progressObj = {
      processedTracks: summary?.trackCount ?? session.writtenCount,
      writtenTracks: summary?.writtenCount ?? session.writtenCount,
      skippedTracks: summary?.skippedCount ?? 0,
      failedTracks: summary?.failedCount ?? 0,
      isTruncated,
    };

    const completedAt = summary?.completedAt ?? new Date().toISOString();
    const createdAt = session.metadata?.createdAt ?? summary?.createdAt ?? completedAt;
    const exportedAt = completedAt;

    if (this.pretty) {
      const closing = [
        '\n  ],',
        `  "status": "completed",`,
        `  "isTruncated": ${isTruncated},`,
        `  "stats": ${JSON.stringify(progressObj, null, 2).replace(/\n/g, '\n  ')},`,
        `  "progress": ${JSON.stringify(progressObj, null, 2).replace(/\n/g, '\n  ')},`,
        `  "createdAt": ${JSON.stringify(createdAt)},`,
        `  "completedAt": ${JSON.stringify(completedAt)},`,
        `  "exportedAt": ${JSON.stringify(exportedAt)}`,
        '}\n',
      ].join('\n');
      return closing;
    }

    return `],"status":"completed","isTruncated":${isTruncated},"stats":${JSON.stringify(
      progressObj
    )},"progress":${JSON.stringify(progressObj)},"createdAt":${JSON.stringify(
      createdAt
    )},"completedAt":${JSON.stringify(completedAt)},"exportedAt":${JSON.stringify(exportedAt)}}`;
  }
}
