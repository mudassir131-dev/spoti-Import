# Architecture Note 95: Offline Cache Invalidation and TTL Policy

## Overview
Architectural caching layer defining TTL and eviction policies for offline testing fixtures and metadata mocks.

## Key Principles
1. Content-hash keyed disk cache for retrieved public Spotify playlist snapshots.
2. Default 24-hour time-to-live (TTL) window for cached playlist metadata.
3. Explicit bypass flag (`--no-cache`) triggering fresh network synchronization.
4. Cache index isolation preventing corruption between concurrent CLI sessions.
