# ADR-123: Standardize on RFC 4180 Strict CRLF Line Endings for CSV Files

## Status
Accepted

## Context
Unix LF line endings produced formatting anomalies when opened in Microsoft Excel on Windows.

## Decision
Enforce strict CRLF (\r\n) row terminators in all CSV export adapters per the RFC 4180 standard.

## Consequences
Ensures flawless spreadsheet compatibility across Excel, Google Sheets, and LibreOffice on all platforms.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
