# Architecture Note 81: Validation Strictness Matrix and Error Aggregation

## Overview
Comprehensive architectural specification for validation strictness matrix and error aggregation within the Universal Music Import Engine.

## Key Principles
1. Strict mode: rejects entire document on first schema violation.
2. Lenient mode: sanitizes invalid fields with clean defaults and aggregates warnings.
3. Comprehensive validation report containing file paths, line numbers, and JSON pointers.
4. Zero unhandled exceptions during malformed JSON or CSV parsing.
