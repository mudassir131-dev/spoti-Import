import { z } from 'zod';
import { SpotifyConfigError } from '../client/spotify-errors.js';

export const SpotifyConfigSchema = z.object({
  clientId: z.string({
    required_error: 'SPOTIFY_CLIENT_ID is required',
    invalid_type_error: 'SPOTIFY_CLIENT_ID must be a string',
  }).trim().min(1, 'SPOTIFY_CLIENT_ID cannot be empty'),
  clientSecret: z.string({
    required_error: 'SPOTIFY_CLIENT_SECRET is required',
    invalid_type_error: 'SPOTIFY_CLIENT_SECRET must be a string',
  }).trim().min(1, 'SPOTIFY_CLIENT_SECRET cannot be empty'),
  redirectUri: z.string({
    required_error: 'SPOTIFY_REDIRECT_URI is required',
    invalid_type_error: 'SPOTIFY_REDIRECT_URI must be a string',
  }).trim().url('SPOTIFY_REDIRECT_URI must be a valid URL'),
});

export type SpotifyConfig = z.infer<typeof SpotifyConfigSchema>;

export function validateSpotifyConfig(raw: unknown): SpotifyConfig {
  const parseResult = SpotifyConfigSchema.safeParse(raw);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const summary = errorDetails.map((e) => `${e.path || 'config'}: ${e.message}`).join('; ');
    throw new SpotifyConfigError(`Invalid Spotify configuration: ${summary}`, { issues: errorDetails });
  }
  return parseResult.data;
}
