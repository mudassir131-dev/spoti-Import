# ADR-080: Graceful Retry Backoff Strategies for CLI Network Dropouts

## Status
Accepted

## Context
Transient network partitions or packet loss during long streaming sessions can abort imports mid-stream if retries are not configured with exponential backoff and jitter.

## Decision
Embed exponential backoff with decorrelated full jitter into the CLI HTTP transport layer, capping retries at 5 attempts before surfacing a recoverable checkpoint state.

## Consequences
- Maximizes completion probability over unreliable connections.
- Prevents thunderous herd retries against upstream Spotify endpoints.
