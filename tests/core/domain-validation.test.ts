import { describe, it, expect } from 'vitest';
import {
  ImportedTrackSchema,
  ImportedArtistSchema,
  ImportedAlbumSchema,
  ImportedPlaylistSchema,
  DefaultTrackNormalizer,
  ValidationError,
  MAX_IMPORT_TRACKS,
  DEFAULT_BATCH_SIZE,
} from '../../src/index.js';

describe('Domain Models and Normalization', () => {
  const normalizer = new DefaultTrackNormalizer();

  it('validates a complete valid track correctly', () => {
    const raw = {
      source: 'custom-src',
      sourceId: 'track-42',
      title: 'Midnight City',
      artists: [{ name: 'M83', sourceId: 'art-m83' }],
      album: {
        title: 'Hurry Up, We\'re Dreaming',
        sourceId: 'alb-m83',
        releaseDate: '2011-10-18',
        totalTracks: 22,
      },
      albumArtist: 'M83',
      durationMs: 243000,
      isrc: 'FR01A1100870',
      trackNumber: 2,
      discNumber: 1,
      explicit: false,
      artwork: 'https://images.example.com/m83.jpg',
      metadata: { customField: 'test' },
    };

    const normalized = normalizer.normalize(raw);
    expect(normalized).toEqual(raw);
  });

  it('validates a minimal track where optional fields are omitted', () => {
    const minimal = {
      source: 'src-1',
      sourceId: 'id-1',
      title: 'Solo',
      artists: [{ name: 'Frank Ocean' }],
    };

    const parsed = ImportedTrackSchema.parse(minimal);
    expect(parsed.title).toBe('Solo');
    expect(parsed.album).toBeUndefined();
    expect(parsed.durationMs).toBeUndefined();
    expect(parsed.isrc).toBeUndefined();
  });

  it('throws ValidationError when required track fields are missing', () => {
    const invalid = {
      source: 'src-1',
      // missing sourceId
      title: 'Missing sourceId',
      artists: [], // empty artists
    };

    expect(() => normalizer.normalize(invalid, 0)).toThrow(ValidationError);

    try {
      normalizer.normalize(invalid, 0);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const valErr = err as ValidationError;
      expect(valErr.code).toBe('VALIDATION_ERROR');
      expect(valErr.details).toHaveProperty('issues');
    }
  });

  it('validates Artist, Album, and Playlist models', () => {
    expect(() =>
      ImportedArtistSchema.parse({ name: 'Daft Punk' })
    ).not.toThrow();

    expect(() =>
      ImportedAlbumSchema.parse({ title: 'Discovery' })
    ).not.toThrow();

    expect(() =>
      ImportedPlaylistSchema.parse({
        source: 'local',
        sourceId: 'pl-1',
        title: 'Electronic Classics',
      })
    ).not.toThrow();
  });

  it('maintains centralized constants', () => {
    expect(MAX_IMPORT_TRACKS).toBe(10_000);
    expect(DEFAULT_BATCH_SIZE).toBe(100);
  });
});
