# ADR-068: Silence and Quiet Mode Flags in CLI

## Status
Accepted

## Context
Automated scripts, cron jobs, and background workers require running CLI commands without progress chatter on stderr.

## Decision
Implement `--quiet` (`-q`) flag on all commands to suppress diagnostic and progress messages.

## Consequences
- Clean execution in automation environments.
- Errors still report on stderr when failures occur.
