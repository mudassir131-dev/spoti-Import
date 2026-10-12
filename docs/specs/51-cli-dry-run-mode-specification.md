# Technical Specification: CLI Dry-Run Execution Mode

## Standard
Formal technical specification for CLI dry-run execution mode.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. No filesystem mutations or destination writes may take place.
2. Source metadata parsing and normalizer pipelines must execute fully.
3. CLI exit code must be 0 upon successful validation.
