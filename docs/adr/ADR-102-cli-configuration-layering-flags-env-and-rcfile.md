# ADR-102: CLI Configuration Layering Flags Env and RC File

## Status
Accepted

## Context
Developers require flexibility to configure defaults without repeatedly passing dozens of command line arguments.

## Decision
Establish a strict 3-tier precedence hierarchy: CLI Flags > Environment Variables > `.musicimportrc` File > System Defaults.

## Consequences
- Predictable configuration resolution with clear diagnostics.
- Allows project-specific repository defaults alongside CI environment overrides.
