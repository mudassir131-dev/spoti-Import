# ADR-070: Public vs Authenticated Mode Toggle in CLI

## Status
Accepted

## Context
Users may import public playlists without Spotify credentials, or use developer API credentials for private/extended playlists.

## Decision
Default to public credential-free scraping mode via `SpotifyPublicPlaylistSource`, automatically switching to authenticated mode when credentials are provided.

## Consequences
- Zero setup friction for casual public playlist imports.
- Full support for developer credentials when higher rate limits or private playlists are needed.
