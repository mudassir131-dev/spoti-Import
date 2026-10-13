# Technical Specification 65: NDJSON Streaming Serializer

## Standard
Formal specification for newline-delimited JSON export serialization.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Each track entity must be formatted on a single line terminated by LF (\n).
2. JSON records must conform strictly to ImportedTrackSchema.
3. Output stream must not emit opening or closing square brackets.
