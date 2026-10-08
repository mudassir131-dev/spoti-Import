import { describe, it, expect, vi } from 'vitest';
import {
  JsonMusicDestination,
  ImportEngine,
  InMemoryMusicSource,
  CURRENT_SCHEMA_VERSION,
  type ImportedTrack,
  type ImportedPlaylist,
} from '../../src/index.js';

describe('Phase 5 JSON Exporter (PR 2)', () => {
  function makeTrack(id: string, title: string, artistName = 'Artist'): ImportedTrack {
    return {
      source: 'spotify',
      sourceId: id,
      title,
      artists: [{ name: artistName, sourceId: `art_${id}` }],
      album: {
        title: `Album for ${title}`,
        sourceId: `alb_${id}`,
        releaseDate: '2025-01-01',
      },
      durationMs: 200000,
      trackNumber: 1,
      discNumber: 1,
      explicit: false,
    };
  }

  it('produces valid JSON with correct schemaVersion, playlist info, and tracks', async () => {
    const destination = new JsonMusicDestination({ pretty: true });
    const tracks: ImportedTrack[] = [
      makeTrack('track_1', 'First Song', 'Artist Alpha'),
      makeTrack('track_2', 'Second Song', 'Artist Beta'),
    ];

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_rock',
      title: 'Rock Greats',
      description: 'Classic rock tracks',
      owner: 'rock_curator',
      totalTracks: 2,
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_rock: { playlist, tracks },
    });

    const engine = new ImportEngine({ source, destination });
    const result = await engine.importPlaylist({
      playlistId: 'pl_rock',
      jobId: 'json-test-job-1',
    });

    expect(result.success).toBe(true);

    const jsonStr = destination.getJsonString('json-test-job-1');
    expect(jsonStr).toBeTypeOf('string');

    // Parse to ensure valid JSON
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.source).toBe('in-memory-source');
    expect(parsed.importId).toBe('json-test-job-1');
    expect(parsed.playlist.id).toBe('pl_rock');
    expect(parsed.playlist.name).toBe('Rock Greats');
    expect(parsed.playlist.owner).toBe('rock_curator');
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.tracks[0].title).toBe('First Song');
    expect(parsed.tracks[1].title).toBe('Second Song');
    expect(parsed.progress.writtenTracks).toBe(2);
    expect(parsed.progress.processedTracks).toBe(2);
    expect(parsed.progress.isTruncated).toBe(false);
  });

  it('preserves exact playlist ordering and duplicate occurrences', async () => {
    const destination = new JsonMusicDestination({ pretty: false });
    const tracks: ImportedTrack[] = [
      makeTrack('dup_1', 'Track A'),
      makeTrack('dup_2', 'Track B'),
      makeTrack('dup_1', 'Track A'), // Duplicate
      makeTrack('dup_3', 'Track C'),
    ];

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_dups',
      title: 'Duplicates Playlist',
      totalTracks: 4,
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_dups: { playlist, tracks },
    });

    const engine = new ImportEngine({ source, destination });
    const result = await engine.importPlaylist({
      playlistId: 'pl_dups',
      jobId: 'json-job-dups',
      deduplicate: false,
    });

    expect(result.success).toBe(true);

    const parsed = destination.getParsedJson<{ tracks: ImportedTrack[] }>('json-job-dups');
    expect(parsed.tracks).toHaveLength(4);
    expect(parsed.tracks[0]!.sourceId).toBe('dup_1');
    expect(parsed.tracks[1]!.sourceId).toBe('dup_2');
    expect(parsed.tracks[2]!.sourceId).toBe('dup_1');
    expect(parsed.tracks[3]!.sourceId).toBe('dup_3');
  });

  it('correctly handles an empty playlist import', async () => {
    const destination = new JsonMusicDestination();
    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_empty',
      title: 'Empty Playlist',
      totalTracks: 0,
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_empty: { playlist, tracks: [] },
    });

    const engine = new ImportEngine({ source, destination });
    const result = await engine.importPlaylist({
      playlistId: 'pl_empty',
      jobId: 'json-job-empty',
    });

    expect(result.success).toBe(true);

    const parsed = destination.getParsedJson<{
      tracks: ImportedTrack[];
      progress: { writtenTracks: number };
    }>('json-job-empty');
    expect(parsed.tracks).toEqual([]);
    expect(parsed.progress.writtenTracks).toBe(0);
  });

  it('preserves truncation metadata when limit is applied', async () => {
    const destination = new JsonMusicDestination();
    const tracks: ImportedTrack[] = [
      makeTrack('t1', 'Song 1'),
      makeTrack('t2', 'Song 2'),
      makeTrack('t3', 'Song 3'),
    ];

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_trunc',
      title: 'Truncated Playlist',
      totalTracks: 3,
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_trunc: { playlist, tracks },
    });

    const engine = new ImportEngine({ source, destination });
    const result = await engine.importPlaylist({
      playlistId: 'pl_trunc',
      jobId: 'json-job-trunc',
      limit: 2,
    });

    expect(result.success).toBe(true);
    expect(result.isTruncated).toBe(true);

    const parsed = destination.getParsedJson<{
      tracks: ImportedTrack[];
      progress: { writtenTracks: number; isTruncated: boolean };
    }>('json-job-trunc');
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.progress.isTruncated).toBe(true);
  });

  it('supports incremental streaming chunk writing without holding all tracks in memory', async () => {
    const chunks: string[] = [];
    const chunkWriter = vi.fn((chunk: string) => {
      chunks.push(chunk);
    });

    const destination = new JsonMusicDestination({
      writeChunk: chunkWriter,
      streamOnly: true,
    });

    const tracks: ImportedTrack[] = [
      makeTrack('st1', 'Stream 1'),
      makeTrack('st2', 'Stream 2'),
      makeTrack('st3', 'Stream 3'),
    ];

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_stream',
      title: 'Stream Playlist',
      totalTracks: 3,
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_stream: { playlist, tracks },
    });

    const engine = new ImportEngine({ source, destination });
    const result = await engine.importPlaylist({
      playlistId: 'pl_stream',
      jobId: 'json-job-stream',
      batchSize: 1, // Flush each track individually
    });

    expect(result.success).toBe(true);
    expect(chunkWriter).toHaveBeenCalled();
    expect(chunks.length).toBeGreaterThanOrEqual(4); // header + 3 batches + footer

    const assembledJson = chunks.join('');
    const parsed = JSON.parse(assembledJson);
    expect(parsed.tracks).toHaveLength(3);
    expect(parsed.tracks[0].title).toBe('Stream 1');
    expect(parsed.tracks[2].title).toBe('Stream 3');

    // streamOnly prevents calling getJsonString
    expect(() => destination.getJsonString('json-job-stream')).toThrow();
  });

  it('sanitizes and strictly strips any secrets from track and playlist metadata', async () => {
    const destination = new JsonMusicDestination();
    const trackWithSecrets: ImportedTrack = {
      source: 'spotify',
      sourceId: 'secret_trk',
      title: 'Confidential Song',
      artists: [{
        name: 'Secret Artist',
        metadata: {
          spotify_secret_token: 'SUPER_SECRET_TOKEN_DO_NOT_LEAK',
          safe_genre: 'ambient',
        },
      }],
      metadata: {
        access_token: 'BQD8723648723648723',
        client_secret: 'ABCDEF123456',
        public_bpm: 120,
      },
    };

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_secrets',
      title: 'Playlist With Secret Config',
      totalTracks: 1,
      metadata: {
        oauth_bearer: 'Bearer BQD...',
        visible_tag: 'curated',
      },
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_secrets: { playlist, tracks: [trackWithSecrets] },
    });

    const engine = new ImportEngine({ source, destination });
    await engine.importPlaylist({
      playlistId: 'pl_secrets',
      jobId: 'json-job-security',
    });

    const jsonStr = destination.getJsonString('json-job-security');

    // Verify secrets are strictly absent
    expect(jsonStr).not.toContain('SUPER_SECRET_TOKEN_DO_NOT_LEAK');
    expect(jsonStr).not.toContain('BQD8723648723648723');
    expect(jsonStr).not.toContain('ABCDEF123456');
    expect(jsonStr).not.toContain('oauth_bearer');

    // Verify safe fields are preserved
    expect(jsonStr).toContain('ambient');
    expect(jsonStr).toContain('public_bpm');
    expect(jsonStr).toContain('curated');
  });

  it('efficiently streams 10,000 tracks without memory explosion', async () => {
    let writtenChunkCount = 0;
    let totalBytesWritten = 0;

    const destination = new JsonMusicDestination({
      writeChunk: (chunk) => {
        writtenChunkCount++;
        totalBytesWritten += chunk.length;
      },
      streamOnly: true,
    });

    const tracks: ImportedTrack[] = [];
    for (let i = 0; i < 10_000; i++) {
      tracks.push(makeTrack(`trk_${i}`, `Track ${i}`));
    }

    const playlist: ImportedPlaylist = {
      source: 'spotify',
      sourceId: 'pl_10k',
      title: 'Ten Thousand Tracks',
      totalTracks: 10_000,
    };

    const source = new InMemoryMusicSource('in-memory-source', {
      pl_10k: { playlist, tracks },
    });

    const engine = new ImportEngine({ source, destination });
    const startTime = performance.now();
    const result = await engine.importPlaylist({
      playlistId: 'pl_10k',
      jobId: 'json-job-10k',
      batchSize: 500,
    });
    const durationMs = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.progress.writtenTracks).toBe(10_000);
    expect(writtenChunkCount).toBeGreaterThanOrEqual(20);
    expect(totalBytesWritten).toBeGreaterThan(1_000_000);
    // Ensure reasonable execution speed for 10k items
    expect(durationMs).toBeLessThan(10_000);
  });
});
