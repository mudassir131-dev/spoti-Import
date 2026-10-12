# ADR-081: Export Integrity Checksum SHA-256 Calculation and Verification

## Status
Accepted

## Context
Downstream consumers (such as Android Room importers or cloud archival pipelines) need cryptographic guarantees that exported files have not suffered silent bitrot or partial truncation.

## Decision
Calculate a streaming SHA-256 digest alongside chunk streaming and embed the final digest into the finalized `ImportManifest` audit document.

## Consequences
- End-to-end verifiable data integrity for JSON and RFC 4180 CSV exports.
- Fast non-destructive integrity checks via `music-import validate`.
