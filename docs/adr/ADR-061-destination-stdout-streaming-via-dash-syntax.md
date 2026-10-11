# ADR-061: Destination Stdout Streaming via Dash Syntax

## Status
Accepted

## Context
Standard CLI conventions allow specifying `-` as an output target or omitting the destination flag entirely to direct output to standard output.

## Decision
Support omitting `--out` / `-o` or passing `-` to stream generated content to stdout.

## Consequences
- Seamless integration with standard UNIX filter pipelines and redirection operators.
- Natural user expectations align with established tooling.
