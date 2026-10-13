# ADR-110: Adopt Append-Only Write-Ahead Logging for Crash-Resilient Checkpoints

## Status
Accepted

## Context
Overwriting the checkpoint JSON file directly risked data corruption if the system crashed mid-write.

## Decision
Use an append-only WAL log file for checkpoint updates, accompanied by an explicit compaction phase.

## Consequences
Completely eliminates partial write corruption and enables zero-loss recovery from sudden process crashes.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
