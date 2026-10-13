# Technical Specification 73: Zod Runtime Ingest Validator

## Standard
Formal specification for runtime validation of external API response payloads.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. All raw Spotify API payloads must be parsed via strict Zod schemas before domain mapping.
2. Non-fatal schema mismatches in track items must be logged as warnings without halting import.
3. Missing mandatory fields must trigger graceful fallback substitution where documented.
