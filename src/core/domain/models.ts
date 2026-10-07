import { z } from 'zod';
import type { ImportErrorPayload } from './errors.js';

export const ImportedArtistSchema = z.object({
  name: z.string().min(1, 'Artist name cannot be empty'),
  sourceId: z.string().optional(),
  roles: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ImportedArtist = z.infer<typeof ImportedArtistSchema>;
