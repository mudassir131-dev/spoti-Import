# ADR-054: Stream-Only Output Without In-Memory Buffering

## Status
Accepted

## Context
Playlists can contain up to 10,000 tracks. Accumulating entire output payloads in memory before writing causes high heap consumption and risk of out-of-memory errors.

## Decision
Route CLI exports through streaming destination adapters (`JsonMusicDestination`, `CsvMusicDestination`) that flush batches incrementally to file or stdout.

## Consequences
- Constant low memory footprint regardless of playlist length.
- Instantaneous chunk writing as batches complete.
