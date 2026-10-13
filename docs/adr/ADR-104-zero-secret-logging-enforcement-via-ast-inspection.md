# ADR-104: Zero Secret Logging Enforcement via AST Inspection

## Status
Accepted

## Context
Sensitive credentials (client secrets, bearer tokens) must never leak into log files, manifests, or terminal output.

## Decision
Implement a centralized redaction regex filter and add automated static analysis test assertions scanning log payload formats.

## Consequences
- Zero credential leakage guarantee across all log verbosity levels.
- Immediate CI failure if unredacted auth tokens appear in test outputs.
