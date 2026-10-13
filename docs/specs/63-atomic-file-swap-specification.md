# Technical Specification 63: Atomic File Swap Protocol

## Standard
Formal specification for crash-resilient atomic file write and rename operations.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Direct output writes must target intermediate temporary file with unique PID suffix.
2. Target file must only be created or replaced via atomic rename after stream close.
3. Any unhandled write error must trigger immediate deletion of the temporary file.
