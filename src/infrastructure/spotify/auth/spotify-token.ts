import { z } from 'zod';

export const SpotifyTokenResponseSchema = z.object({
  access_token: z.string().min(1, 'access_token must not be empty'),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().int().positive('expires_in must be a positive integer'),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type SpotifyTokenResponse = z.infer<typeof SpotifyTokenResponseSchema>;
