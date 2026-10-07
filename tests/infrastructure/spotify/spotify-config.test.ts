import { describe, it, expect } from 'vitest';
import {
  validateSpotifyConfig,
  loadSpotifyConfigFromEnv,
  SpotifyConfigError,
} from '../../../src/index.js';

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

  it('2. throws SpotifyConfigError when client ID is missing or empty', () => {
    expect(() =>
      validateSpotifyConfig({ ...validConfig, clientId: '' })
    ).toThrow(SpotifyConfigError);

    expect(() =>
      validateSpotifyConfig({
        clientSecret: 'test-client-secret',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow(SpotifyConfigError);

    try {
      validateSpotifyConfig({ ...validConfig, clientId: '' });
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyConfigError);
      const confErr = err as SpotifyConfigError;
      expect(confErr.code).toBe('SPOTIFY_CONFIG_ERROR');
      expect(confErr.message).toContain('SPOTIFY_CLIENT_ID');
    }
  });

  it('3. throws SpotifyConfigError when client secret is missing or empty', () => {
    expect(() =>
      validateSpotifyConfig({ ...validConfig, clientSecret: '' })
    ).toThrow(SpotifyConfigError);

    expect(() =>
      validateSpotifyConfig({
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow(SpotifyConfigError);

    try {
      validateSpotifyConfig({ ...validConfig, clientSecret: '' });
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyConfigError);
      const confErr = err as SpotifyConfigError;
      expect(confErr.code).toBe('SPOTIFY_CONFIG_ERROR');
      expect(confErr.message).toContain('SPOTIFY_CLIENT_SECRET');
    }
  });

  it('4. throws SpotifyConfigError when redirect URI is missing or not a valid URL', () => {
    expect(() =>
      validateSpotifyConfig({ ...validConfig, redirectUri: 'not-a-url' })
    ).toThrow(SpotifyConfigError);

    expect(() =>
      validateSpotifyConfig({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
    ).toThrow(SpotifyConfigError);

    try {
      validateSpotifyConfig({ ...validConfig, redirectUri: 'not-a-valid-url' });
    } catch (err) {
      expect(err).toBeInstanceOf(SpotifyConfigError);
      const confErr = err as SpotifyConfigError;
      expect(confErr.code).toBe('SPOTIFY_CONFIG_ERROR');
      expect(confErr.message).toContain('SPOTIFY_REDIRECT_URI');
    }
  });

  it('loads valid configuration successfully from environment variables map', () => {
    const env = {
      SPOTIFY_CLIENT_ID: 'test-client-id-env',
      SPOTIFY_CLIENT_SECRET: 'test-client-secret-env',
      SPOTIFY_REDIRECT_URI: 'https://app.example.com/oauth/spotify/callback',
    };

    const config = loadSpotifyConfigFromEnv(env);
    expect(config.clientId).toBe('test-client-id-env');
    expect(config.clientSecret).toBe('test-client-secret-env');
    expect(config.redirectUri).toBe('https://app.example.com/oauth/spotify/callback');
  });
});
