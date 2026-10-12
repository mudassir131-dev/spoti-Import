# Developer Guide 75: Tuning Performance for Unstable Network Connections

## Objectives
Step-by-step guidance on tuning performance for unstable network connections within the Universal Music Import Engine ecosystem.

## Steps
1. Lower the batch chunk size using `--batch-size 25`.
2. Enable automatic retry backoff using `--max-retries 5`.
3. Check that checkpoints are stored persistently so interrupted runs can be resumed cleanly.
