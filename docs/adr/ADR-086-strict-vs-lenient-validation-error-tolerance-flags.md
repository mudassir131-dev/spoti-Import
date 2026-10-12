# ADR-086: Strict vs Lenient Validation Error Tolerance Flags

## Status
Accepted

## Context
Third-party music metadata frequently contains non-standard fields, missing release dates, or anomalous ISRC formatting that can cause strict schema rejections.

## Decision
Provide a `--lenient` flag in `music-import validate` and `import` to substitute invalid or missing optional metadata with clean nulls rather than aborting.

## Consequences
- High tolerance for dirty real-world public playlist metadata.
- Strict mode remains the default for production ingestion and compliance audits.
