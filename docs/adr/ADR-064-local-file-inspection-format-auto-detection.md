# ADR-064: Local File Inspection Format Auto-Detection

## Status
Accepted

## Context
Users may pass previously exported JSON or CSV files to the `inspect` command to view their summary and sample contents.

## Decision
The `inspect` command auto-detects whether the target is a remote Spotify URL/ID or a local filesystem path, automatically parsing JSON or CSV according to extension and content.

## Consequences
- Unified inspection command for both upstream remote sources and downstream exported artifacts.
- Simplified CLI surface without requiring separate local inspector tools.
