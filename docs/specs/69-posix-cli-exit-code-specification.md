# Technical Specification 69: POSIX CLI Exit Code Matrix

## Standard
Formal specification for deterministic process exit codes across CLI operations.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Successful import execution must yield exit code 0.
2. Argument syntax and validation failures must yield exit code 2.
3. Authentication and OAuth token failures must yield exit code 3.
4. Upstream rate limiting (HTTP 429) exhaustion must yield exit code 4.
