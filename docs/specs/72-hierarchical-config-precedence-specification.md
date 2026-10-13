# Technical Specification 72: Hierarchical Config Precedence

## Standard
Formal specification for layered configuration resolution.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Explicit CLI arguments must override all other sources.
2. Environment variables prefixed with SPOTI_ must take second priority.
3. Local .musicimportrc file must take third priority over global system defaults.
