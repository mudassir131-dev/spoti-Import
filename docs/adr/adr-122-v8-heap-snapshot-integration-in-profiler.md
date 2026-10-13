# ADR-122: Adopt Programmatic V8 Heap Sampling for Leak Detection Test Suites

## Status
Accepted

## Context
Regressions in memory consumption were difficult to detect using standard functional unit tests.

## Decision
Integrate v8 heap sampling into the automated CI test pipeline to fail tests if memory leaks are detected.

## Consequences
Guarantees that memory regression bugs are caught before reaching main branch releases.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
