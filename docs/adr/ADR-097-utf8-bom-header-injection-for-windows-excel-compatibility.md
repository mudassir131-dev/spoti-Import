# ADR-097: UTF-8 BOM Header Injection for Windows Excel Compatibility

## Status
Accepted

## Context
Microsoft Excel on Windows opens UTF-8 encoded CSV files using legacy ANSI code pages unless a byte order mark (BOM) is present.

## Decision
Provide an optional `--excel-bom` flag for CSV exports that prepends the standard UTF-8 BOM sequence (`0xEF, 0xBB, 0xBF`).

## Consequences
- Non-ASCII song and artist names (e.g. Japanese, Arabic, accented characters) display properly in Excel out of the box.
- Preserves raw UTF-8 as default behavior when the flag is omitted.
