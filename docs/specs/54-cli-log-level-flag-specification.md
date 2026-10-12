# Technical Specification: CLI Log Level Flag

## Standard
Formal technical specification for CLI log level flag.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Accepted log level values must be: silent, error, warn, info, debug.
2. All log diagnostics must be directed strictly to stderr.
3. Output on stdout must remain unpolluted for clean piping.
