# Technical Specification 75: Android SQLite Schema Interchange

## Standard
Formal specification for relational data interchange mapping to mobile Room/SQLite schemas.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Column types must map cleanly to standard SQLite primitives (TEXT, INTEGER, REAL).
2. Primary keys must align with Spotify track URI or canonical ISRC hash.
3. Multi-value string arrays must serialize as semicolon-delimited text.
