# Architecture Note 54: CLI Stream IO Abstraction

## Overview
Comprehensive architectural specification for CLI stream IO abstraction within the Universal Music Import Engine.

## Key Principles
1. Complete isolation of stdout and stderr streams.
2. Direct piping of structured payloads to stdout.
3. Diagnostics and progress emission exclusively to stderr.
4. Virtual IO hooks for test verification.
