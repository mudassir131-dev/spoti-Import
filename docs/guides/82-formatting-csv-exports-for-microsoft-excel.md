# Developer Guide 82: Formatting CSV Exports for Microsoft Excel

## Objectives
Ensure exported CSV files open correctly in Microsoft Excel without character encoding glitches.

## Steps
1. Append the Excel BOM flag during export: `music-import import <playlist> --format csv --excel-bom`.
2. Open the resulting CSV directly in Microsoft Excel on Windows or macOS.
3. Confirm non-ASCII song titles and international artist names display with proper glyphs.
