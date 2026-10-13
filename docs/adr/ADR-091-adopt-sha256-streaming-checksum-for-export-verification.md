# ADR-091: Streaming SHA256 Export Checksum Verification

## Status
Accepted

## Context
Downstream consumers require cryptographically secure verification that exported files have not been corrupted during generation or disk writing.

## Decision
Incorporate streaming Node.js crypto SHA256 hashing into all destination sink streams, calculating the digest concurrently with serialization.

## Consequences
- Guarantees data integrity without requiring a second read pass over generated export files.
- Manifest record includes verified checksum field for auditing.
