# Architecture Note 97: RFC 4180 CRLF Line Ending Preservation Layer

## Overview
Architectural layer ensuring strict RFC 4180 CRLF (\r\n) row delimitation across both Windows and Unix runtimes.

## Key Principles
1. Explicit standard RFC 4180 line ending requirement regardless of host OS platform.
2. Prevention of accidental Unix LF-only line splitting by downstream spreadsheet processors.
3. Quote-wrapping and escaping of internal CRLF characters inside song title and artist fields.
4. Deterministic byte-for-byte export parity across macOS, Linux, and Windows test runners.
