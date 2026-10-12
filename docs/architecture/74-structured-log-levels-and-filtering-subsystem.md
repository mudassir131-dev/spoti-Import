# Architecture Note 74: Structured Log Levels and Filtering Subsystem

## Overview
Comprehensive architectural specification for structured log levels and filtering subsystem within the Universal Music Import Engine.

## Key Principles
1. Strict separation: stdout reserved for data formats, stderr for diagnostics.
2. Configurable verbosity tiers: SILENT, ERROR, WARN, INFO, DEBUG.
3. ISO-8601 millisecond timestamps and structured context tags in debug mode.
4. Safe redaction filters preventing secret token leakage across all levels.
