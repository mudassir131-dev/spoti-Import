# ADR-101: Track ISRC Canonical Identifier Normalization

## Status
Accepted

## Context
International Standard Recording Code (ISRC) values from source APIs may contain inconsistent casing or hyphen formatting.

## Decision
Normalize all ingested ISRC codes to uppercase alphanumeric strings matching `^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$`.

## Consequences
- Prevents false-negative duplicate detection across different playlist releases of the same master recording.
- Guarantees standard interchange compliance across music service catalogs.
