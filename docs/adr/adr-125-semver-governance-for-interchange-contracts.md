# ADR-125: Adopt Semantic Versioning Governance for Interchange Schema Evolutions

## Status
Accepted

## Context
The Kotlin Android app and TypeScript core require a predictable contract for coordinating future data schema changes.

## Decision
Apply strict Semantic Versioning to the interchange contract: additive fields are minor, breaking changes require major bumps.

## Consequences
Protects mobile clients from breaking contract mismatches and enables seamless forward migrations.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
