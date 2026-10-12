# ADR-083: Streaming NDJSON (JSON Lines) Output Adapter Architecture

## Status
Accepted

## Context
Data engineering pipelines often ingest newline-delimited JSON (NDJSON / .jsonl) for distributed processing systems like Apache Spark, BigQuery, and Logstash.

## Decision
Introduce support for the `ndjson` format in `MusicDestination`, streaming one serialized `ImportedTrack` JSON object per line without outer array enclosures.

## Consequences
- Seamless line-by-line streaming directly to Unix command pipelines (`grep`, `sed`, `awk`).
- Minimal memory overhead with constant O(1) serialization complexity.
