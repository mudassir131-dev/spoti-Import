# ADR-060: Pretty-Print vs Compact JSON Export Flags

## Status
Accepted

## Context
Different consumer use cases require either human-readable formatted JSON or compact, minimal-size JSON for storage and transmission efficiency.

## Decision
Provide the `--pretty` (`-p`) flag on the `import` command. Defaults to compact single-line JSON, with 2-space indentation when enabled.

## Consequences
- Flexibility for developers inspecting exports directly in text editors.
- High performance and minimal file sizes for automated pipelines.
