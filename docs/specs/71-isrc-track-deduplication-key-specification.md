# Technical Specification 71: ISRC Track Deduplication Key

## Standard
Formal specification for synthesizing canonical track deduplication identity keys.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. ISRC codes must be validated against regex pattern ^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$.
2. If ISRC is absent, fallback key must combine normalized lowercase title and primary artist name.
3. Deduplication algorithm must be deterministic across all runtimes.
