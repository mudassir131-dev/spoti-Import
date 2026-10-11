# ADR-056: Argv Flag Parsing Without Bulky External Dependencies

## Status
Accepted

## Context
Adding heavy command-line parsing libraries adds bloated transitive dependencies, installation overhead, and supply chain vulnerability surface.

## Decision
Implement a lightweight, zero-dependency argument and flag parser in TypeScript supporting short flags, long flags, key-value pairs, and positional arguments.

## Consequences
- Zero external runtime dependencies beyond core schema validation.
- Sub-millisecond CLI startup time.
