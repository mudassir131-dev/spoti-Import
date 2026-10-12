# Developer Guide 73: Running Offline CLI Tests with Mock Sources

## Objectives
Step-by-step guidance on running offline cli tests with mock sources within the Universal Music Import Engine ecosystem.

## Steps
1. Append the `--mock` flag to any import command.
2. The engine uses embedded in-memory fixtures instead of making outbound Spotify API requests.
3. Validate downstream pipeline integration cleanly in air-gapped CI runners.
