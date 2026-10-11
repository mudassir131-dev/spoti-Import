# Architecture Note 69: CLI Error Reporting and Formatting

## Overview
Comprehensive architectural specification for CLI error reporting and formatting within the Universal Music Import Engine.

## Key Principles
1. Clean user-friendly error messages on stderr.
2. Contextual usage suggestions for argument mistakes.
3. Stack trace suppression unless explicitly configured.
4. Strict POSIX exit code mappings.
