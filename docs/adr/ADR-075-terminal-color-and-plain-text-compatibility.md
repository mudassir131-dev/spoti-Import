# ADR-075: Terminal Color and Plain Text Compatibility

## Status
Accepted

## Context
ANSI color codes in automated logs or non-interactive terminals cause escaping artifacts that degrade automated log scraping.

## Decision
Format CLI outputs cleanly using standard UTF-8 text formatting and symbol indicators (`✓`, `✗`) without hardcoded terminal escape codes.

## Consequences
- Universal readability across Windows PowerShell, Linux shells, CI logs, and plain text files.
- Zero ANSI escaping artifacts in piped output streams.
