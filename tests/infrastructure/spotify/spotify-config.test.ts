import { describe, it, expect } from 'vitest';
import { validateSpotifyConfig, SpotifyConfigError } from '../../../src/infrastructure/spotify/auth/spotify-config.js';

describe('Spotify Configuration & Environment Validation', () => {
  const validConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://example.com/callback',
  };

  it('1. validates a complete and correct Spotify configuration', () => {
    const config = validateSpotifyConfig(validConfig);
    expect(config.clientId).toBe('test-client-id');
    expect(config.clientSecret).toBe('test-client-secret');
    expect(config.redirectUri).toBe('https://example.com/callback');
  });
});
