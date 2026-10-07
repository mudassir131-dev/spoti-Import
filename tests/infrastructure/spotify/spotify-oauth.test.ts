import { describe, it, expect } from 'vitest';
import { SpotifyOAuthService, DEFAULT_SPOTIFY_SCOPES, type SpotifyConfig } from '../../../src/infrastructure/spotify/auth/spotify-oauth.js';

describe('Spotify OAuth Flow & Token Expiration', () => {
  const fakeConfig: SpotifyConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://example.com/oauth/callback',
  };

  it('5 & 7. generates authorization URL with state parameter and default scopes', () => {
    const oauthService = new SpotifyOAuthService({ config: fakeConfig });
    const authUrl = oauthService.createAuthorizationUrl({ state: 'secure-state-123' });

    expect(authUrl).toContain('https://accounts.spotify.com/authorize');
    const parsed = new URL(authUrl);

    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/oauth/callback');
    expect(parsed.searchParams.get('state')).toBe('secure-state-123');
    expect(parsed.searchParams.get('scope')).toBe(DEFAULT_SPOTIFY_SCOPES.join(' '));
  });
});
