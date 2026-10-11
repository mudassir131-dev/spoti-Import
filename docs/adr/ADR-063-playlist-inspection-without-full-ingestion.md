# ADR-063: Playlist Inspection Without Full Ingestion

## Status
Accepted

## Context
Users often need to check playlist title, owner, total track count, and sample tracks without waiting for a full 10,000-track download.

## Decision
Implement the `inspect` command, which fetches playlist metadata and only queries the first requested sample batch (default: 5 tracks).

## Consequences
- Fast sub-second inspection feedback for large playlists.
- Minimal network overhead and quota consumption.
