# ADR-103: Strict Metadata Schema Validation on Source Ingest

## Status
Accepted

## Context
Upstream Spotify API responses occasionally include malformed track entities or null values for required fields.

## Decision
Apply Zod schema parse filters at the source adapter boundary, sanitizing and normalizing before handing off to core domain entities.

## Consequences
- Core domain logic remains clean and free of defensive null-checking boilerplate.
- Invalid tracks are recorded with warning telemetry without failing entire import.
