# Developer Guide 60: Limiting Track Import Counts

## Objectives
Step-by-step guidance on limiting track import counts within the Universal Music Import Engine ecosystem.

## Steps
1. Add `--limit <count>` or `-l <count>` to import operations.
2. Engine bounds ingestion strictly to requested limit.
3. Output marks truncation status if playlist contains more tracks.
