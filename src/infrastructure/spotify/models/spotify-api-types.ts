import { z } from 'zod';

export const SpotifyImageSchema = z.object({
  url: z.string().url(),
  height: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
});
export type SpotifyImage = z.infer<typeof SpotifyImageSchema>;
