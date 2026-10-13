# Technical Specification 61: Streaming SHA256 Hasher

## Standard
Formal specification for streaming SHA256 digest computation during destination export.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Hash calculation must occur concurrently via streaming transform without accumulating complete output in memory.
2. Final digest must be formatted as standard 64-character lowercase hexadecimal string.
3. Computed checksum must be recorded in the final export manifest metadata.
