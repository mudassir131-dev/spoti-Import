# ADR-095: Pluggable Sink Interface for NDJSON Streaming

## Status
Accepted

## Context
Data pipeline architectures frequently consume newline-delimited JSON (NDJSON) rather than monolithic JSON array structures.

## Decision
Implement a dedicated `NdjsonMusicDestination` complying with the standard `MusicDestination` port.

## Consequences
- Native support for line-oriented data pipelines and cloud object storage ingestion.
- O(1) memory footprint during generation of 10,000-track files.
