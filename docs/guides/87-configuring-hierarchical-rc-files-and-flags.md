# Developer Guide 87: Configuring Hierarchical RC Files and Flags

## Objectives
Set up persistent team defaults without polluting source control with personal API tokens.

## Steps
1. Create a project-level `.musicimportrc` containing non-sensitive defaults (batch size, format).
2. Store API credentials in local environment variables (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).
3. Override specific parameters on demand using explicit CLI flags.
