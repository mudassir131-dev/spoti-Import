# ADR-088: CLI Configuration File Discovery

## Status
Accepted

## Context
Repetitive entry of command options (such as default format, batch size, or output directory) creates unnecessary cognitive overhead.

## Decision
Implement a layered configuration discovery engine searching for `.musicimportrc` or `.music-import.json` in the working directory, followed by the user home directory.

## Consequences
- Project-specific configuration files can be committed into repositories.
- CLI flags maintain absolute precedence over configuration file settings.
