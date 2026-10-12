# Technical Specification: NDJSON Streaming Destination

## Standard
Formal technical specification for NDJSON streaming destination.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Each record must be formatted as valid standalone JSON followed by a newline delimiter.
2. No outer array brackets or comma delimiters may be produced.
3. Output stream must support bounded O(1) memory consumption.
