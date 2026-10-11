# ADR-052: POSIX Exit Codes Standardization

## Status
Accepted

## Context
Command-line tools in UNIX and Windows environments communicate completion status to parent processes and CI/CD pipelines via process exit codes.

## Decision
Standardize deterministic CLI exit codes across all commands:
- 0: SUCCESS (successful execution)
- 1: ERROR (runtime failures, validation errors)
- 2: INVALID_ARGUMENTS (syntax error, missing required arguments, unknown flags)
- 130: CANCELLED (SIGINT or AbortSignal cancellation)

## Consequences
- Predictable automation behavior for shell scripts and automated runners.
- Immediate distinguishing between operational errors and usage/argument issues.
