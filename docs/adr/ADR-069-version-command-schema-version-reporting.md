# ADR-069: Version Command Schema Version Reporting

## Status
Accepted

## Context
Consumers of the CLI must be able to verify both the binary release version and the underlying canonical data interchange schema version.

## Decision
Have `music-import version` report both the CLI package version and the canonical interchange schema version (e.g., `music-import v0.1.0 (schema v1)`).

## Consequences
- Eliminates ambiguity regarding data interchange compatibility.
- Provides machine-parseable version information.
