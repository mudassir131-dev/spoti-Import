# ADR-113: Adopt xxHash64 for High-Speed Non-Cryptographic Track Deduplication

## Status
Accepted

## Context
Computing cryptographic SHA-256 hashes for every track identity created an unnecessary CPU bottleneck during bulk imports.

## Decision
Adopt 64-bit xxHash non-cryptographic hash algorithms for in-memory deduplication sets.

## Consequences
Provides 10x faster hash computation with collision probability indistinguishable from zero for millions of tracks.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
