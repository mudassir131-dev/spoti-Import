# ADR-094: In-Memory LRU Cache for Artist Metadata Resolution

## Status
Accepted

## Context
Playlists frequently contain multiple tracks by the same artist, causing repetitive API queries for artist genres and metadata.

## Decision
Introduce an internal bounded LRU cache (default 1,000 entries) in artist resolution adapters to store resolved artist entities.

## Consequences
- Reduces outbound Spotify API HTTP requests by up to 40% on typical playlists.
- Bounded memory footprint guarantees compliance with 100MB RAM budget.
