# ADR-057: Dependency Injection for CLI IO and Exit Handlers

## Status
Accepted

## Context
Testing CLI tools that interact directly with `process.stdout`, `process.stderr`, and `process.exit` is cumbersome and pollutes test test runners.

## Decision
Design `CliRunner` and commands to accept an optional `CliIo` context providing pluggable `stdout`, `stderr`, and cancellation `signal` handlers.

## Consequences
- 100% in-memory testability without mocking global Node.js process streams.
- Isolated test assertions for terminal output and exit codes.
