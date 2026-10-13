# ADR-117: Adopt Atomic Rename from .tmp Files to Guarantee Crash Consistency

## Status
Accepted

## Context
Writing directly to target export paths leaves incomplete, corrupted files if an import is interrupted.

## Decision
Stream all writes to `<path>.tmp` and perform an atomic filesystem rename only upon successful import completion.

## Consequences
Ensures that destination files at the target path are always 100% complete, valid, and uncorrupted.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
