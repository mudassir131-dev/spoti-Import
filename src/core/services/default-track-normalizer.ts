/**
 * Universal Music Import Engine - Default Track Normalizer
 * Validates and normalizes track records against the domain ImportedTrack schema.
 */

import { ImportedTrackSchema, type ImportedTrack } from '../domain/models.js';
import { ValidationError } from '../domain/errors.js';
import type { TrackNormalizer } from '../ports/track-normalizer.js';

export class DefaultTrackNormalizer implements TrackNormalizer {
  normalize(raw: unknown, index?: number): ImportedTrack {
    const parseResult = ImportedTrackSchema.safeParse(raw);
    if (!parseResult.success) {
      const issueSummary = parseResult.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');

      throw new ValidationError(
        `Failed to normalize track${index !== undefined ? ` at index ${index}` : ''}: ${issueSummary}`,
        {
          index,
          issues: parseResult.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
          rawRecord: raw,
        }
      );
    }

    return parseResult.data;
  }
}
