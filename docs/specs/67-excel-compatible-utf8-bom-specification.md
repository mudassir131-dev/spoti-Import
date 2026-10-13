# Technical Specification 67: Excel-Compatible UTF-8 BOM Prefix

## Standard
Formal specification for prepending Byte Order Mark (BOM) in CSV exports.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. When enabled, byte sequence 0xEF, 0xBB, 0xBF must precede all CSV data including headers.
2. BOM sequence must be omitted by default unless explicitly requested.
3. All subsequent CSV data must remain strictly valid UTF-8 and RFC 4180 compliant.
