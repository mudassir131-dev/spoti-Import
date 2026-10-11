# Architecture Note 67: CLI Stdout Piping Architecture

## Overview
Comprehensive architectural specification for CLI stdout piping architecture within the Universal Music Import Engine.

## Key Principles
1. Stdout streaming redirection via dash (-) syntax.
2. Prevention of progress text pollution in redirected streams.
3. High-throughput buffer flushing.
4. Full compatibility with standard UNIX tools (jq, grep, sed).
