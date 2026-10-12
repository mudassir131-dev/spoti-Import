# ADR-078: Playlist Search Filter Query Syntax

## Status
Accepted

## Context
When ingesting extensive playlists, operators frequently need to filter tracks by title, artist, or minimum duration prior to writing.

## Decision
Define declarative filter query parameters evaluated within the normalization pipeline stage before batch buffering, rejecting non-matching items without checkpoint corruption.

## Consequences
- Reduces destination file footprint for targeted exports.
- Retains deterministic tracking of filtered vs processed track counters in the ImportManifest.
