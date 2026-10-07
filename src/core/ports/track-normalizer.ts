/**
 * Universal Music Import Engine - Track Normalizer Port
 */

import type { ImportedTrack } from '../domain/models.js';

export interface TrackNormalizer {
  /**
   * Transforms raw source data into a validated ImportedTrack domain entity.
   */
  normalize(raw: unknown, index?: number): ImportedTrack;
}
