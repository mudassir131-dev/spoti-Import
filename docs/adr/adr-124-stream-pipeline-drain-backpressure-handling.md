# ADR-124: Enforce Node Stream Backpressure Drain Listeners on Slow Disk Sinks

## Status
Accepted

## Context
Fast network fetching combined with slow external disk writes led to unbounded write buffer accumulation.

## Decision
Pause input stream reading whenever write() returns false, resuming only upon the drain event.

## Consequences
Guarantees strictly bounded RAM consumption even when streaming directly to slow network storage drives.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
