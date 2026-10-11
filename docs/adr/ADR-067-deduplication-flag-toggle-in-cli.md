# ADR-067: Deduplication Flag Toggle in CLI

## Status
Accepted

## Context
Playlists frequently contain recurring tracks. Some users want to preserve original playlist order with duplicates, while others need unique tracks.

## Decision
Expose the `--deduplicate` (`-d`) boolean flag on the `import` command, delegating track deduplication to the core import engine.

## Consequences
- Preserves playlist occurrences by default.
- Allows on-demand deduplication by source ID without manual post-processing.
