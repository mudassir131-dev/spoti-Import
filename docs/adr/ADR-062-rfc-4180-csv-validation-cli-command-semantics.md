# ADR-062: RFC 4180 CSV Validation CLI Command Semantics

## Status
Accepted

## Context
CSV exports must adhere strictly to RFC 4180 specifications, including quoting, escaping, and line-ending requirements.

## Decision
The `validate` command includes an RFC 4180 parser checking header order, balanced quotes, and field delimiters when validating CSV files.

## Consequences
- Validates interchange compatibility with spreadsheets, databases, and third-party tools before downstream ingestion.
- Catches formatting anomalies before processing.
