# Technical Specification: File Overwrite Guard

## Standard
Formal technical specification for file overwrite guard.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. If target file exists and force flag is false, execution must terminate with exit code 2.
2. If force flag is true, atomic temporary write staging must overwrite target cleanly.
3. Staging temporary file must be unlinked upon abort or failure.
