# Developer Guide 68: Exporting to NDJSON (JSON Lines) Format

## Objectives
Step-by-step guidance on exporting to ndjson json lines format within the Universal Music Import Engine ecosystem.

## Steps
1. Execute `music-import import <playlist> -f ndjson -o playlist.jsonl`.
2. Inspect the output with `head -n 5 playlist.jsonl`.
3. Pipe individual track lines into stream processing tools.
