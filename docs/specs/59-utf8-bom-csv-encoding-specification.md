# Technical Specification: UTF-8 BOM CSV Encoding

## Standard
Formal technical specification for UTF-8 BOM CSV encoding.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. When BOM flag is enabled, byte sequence 0xEF, 0xBB, 0xBF must prepend file header.
2. Subsequent CSV records must strictly conform to RFC 4180 rules.
3. Default behavior when BOM flag is omitted must remain pure UTF-8 without BOM.
