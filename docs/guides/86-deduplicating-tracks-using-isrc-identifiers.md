# Developer Guide 86: Deduplicating Tracks Using ISRC Identifiers

## Objectives
Clean composite playlists by removing duplicate recordings across albums and compilations.

## Steps
1. Enable track deduplication mode: `music-import import <playlist> --dedup isrc`.
2. Inspect the import summary to review count of deduplicated duplicate tracks.
3. Verify export retains the earliest chronological track instance in the playlist.
