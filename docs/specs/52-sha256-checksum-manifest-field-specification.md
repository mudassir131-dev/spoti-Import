# Technical Specification: SHA-256 Checksum Manifest Field

## Standard
Formal technical specification for SHA-256 checksum manifest field.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Checksum must be computed over the raw output byte stream.
2. Checksum representation must be a 64-character lowercase hexadecimal string.
3. Checksum must match the verified on-disk file hash upon validation.
