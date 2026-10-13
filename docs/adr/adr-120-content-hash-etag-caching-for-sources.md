# ADR-120: Adopt ETag and Content-Hash Caching for Repeated Playlist Fetches

## Status
Accepted

## Context
Re-running imports on unchanged playlists wasted network bandwidth and API quota.

## Decision
Persist HTTP ETag headers and return 304 Not Modified status payloads to bypass unchanged playlist downloads.

## Consequences
Enables instantaneous subsequent imports when playlist content has not changed remotely.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
