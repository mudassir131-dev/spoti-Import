# ADR-074: Mockable Filesystem Handlers for CLI Testing

## Status
Accepted

## Context
Direct filesystem writes during unit tests create disk flakiness, file cleanup complexity, and permission hazards across operating systems.

## Decision
Provide injected `writeFile` and `readFile` dependencies on command factories, defaulting to Node's `node:fs/promises` in production.

## Consequences
- Fast, completely isolated in-memory testing using Map-based virtual filesystems.
- Guaranteed platform independence between Windows and UNIX test environments.
