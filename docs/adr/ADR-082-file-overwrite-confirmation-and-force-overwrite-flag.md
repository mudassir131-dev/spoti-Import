# ADR-082: File Overwrite Confirmation and Force Overwrite Flag

## Status
Accepted

## Context
Accidental overwriting of existing export files without warning can lead to unrecoverable data loss in manual terminal operations.

## Decision
Enforce a pre-flight existence check on the `--out` path. If the target exists, abort with exit code 2 unless `--force` (`-F`) is explicitly provided.

## Consequences
- Accidental data loss prevention by default.
- Scripting workflows remain uninterrupted when supplying the explicit `--force` flag.
