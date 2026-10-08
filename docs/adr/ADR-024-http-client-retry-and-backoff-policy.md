# ADR-024: HTTP Client Retry and Backoff Policy

## Status
Accepted

## Context
The Universal Music Import Engine requires a decoupled, reliable, and strictly typed architecture capable of ingesting playlists from streaming services and outputting canonical data formats.

## Decision
Adopt http client retry and backoff policy across domain models and ports.

## Consequences
- Guaranteed stability, safety, and modularity.
- Decoupled from specific persistent engines (Android, Room, Postgres).
- Full compliance with canonical data exchange standards.
