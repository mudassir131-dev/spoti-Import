# ADR-108: Adopt Newline-Delimited JSON (NDJSON) for Unbounded Exports

## Status
Accepted

## Context
Traditional JSON arrays require loading the entire export into memory to parse brackets and delimiters.

## Decision
Standardize on NDJSON as an optional high-throughput streaming destination format alongside standard JSON and RFC 4180 CSV.

## Consequences
Allows infinite streaming exports with linear memory complexity and instant line-by-line consumption by external utilities.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
