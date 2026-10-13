# Architecture Note 91: Cross-Platform Atomic File Renaming Safeguards

## Overview
Architectural safety pattern ensuring exports are never left in a partial or corrupt state following system or network crashes.

## Key Principles
1. All streaming destinations write to a temporary file with `.tmp.[pid]` suffix.
2. Atomic filesystem rename operation executed only after successful completion and checksum calculation.
3. Cross-platform handling for Windows lock semantics with retry fallback before rename.
4. Automatic cleanup of orphaned temporary files during failure recovery.
