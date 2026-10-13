# Developer Guide 80: Streaming High-Throughput NDJSON Exports

## Objectives
Export playlists as newline-delimited JSON for ingestion into big data pipelines.

## Steps
1. Specify NDJSON format during CLI execution: `music-import import <playlist> --format ndjson`.
2. Pipe output directly into downstream stream processors: `cat export.ndjson | jq .title`.
3. Confirm memory consumption remains stable below 50MB regardless of track count.
