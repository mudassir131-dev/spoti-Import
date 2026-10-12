# ADR-087: Unicode BOM Handling in CSV Exports Across Windows and POSIX

## Status
Accepted

## Context
Microsoft Excel on Windows requires a UTF-8 Byte Order Mark (BOM: `0xEF, 0xBB, 0xBF`) to correctly display multilingual characters, whereas POSIX Unix tools prefer pure UTF-8 without BOM.

## Decision
Add an optional `--bom` flag to the CSV export destination adapter, prepending the UTF-8 BOM only when explicitly targeted for legacy desktop spreadsheet viewers.

## Consequences
- Universal compatibility with Excel for Windows without garbling Japanese, Cyrillic, or Arabic titles.
- Maintains standard pure RFC 4180 UTF-8 as the clean default.
