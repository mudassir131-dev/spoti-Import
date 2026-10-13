# ADR-121: Enforce POSIX Forward Slashes in Core Cross-Platform File Paths

## Status
Accepted

## Context
Windows backslashes in serialized manifests caused parsing errors when manifests were shared with Linux/Android environments.

## Decision
Mandate that all internal file paths and manifest records normalize separators to forward slashes.

## Consequences
Ensures 100% manifest and export portability across operating systems without path conversion bugs.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
