import { z } from 'zod';
import type { ImportErrorPayload } from './errors.js';

export const ImportedArtistSchema = z.object({
  name: z.string().min(1, 'Artist name cannot be empty'),
  sourceId: z.string().optional(),
  roles: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedArtist = z.infer<typeof ImportedArtistSchema>;

export const ImportedAlbumSchema = z.object({
  title: z.string().min(1, 'Album title cannot be empty'),
  sourceId: z.string().optional(),
  releaseDate: z.string().optional(),
  totalTracks: z.number().int().nonnegative().optional(),
  artists: z.array(ImportedArtistSchema).optional(),
  artwork: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedAlbum = z.infer<typeof ImportedAlbumSchema>;
