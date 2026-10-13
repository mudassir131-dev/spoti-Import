# Architecture Note 112: Atomic File Rotation and Transactional Swap for Large Exports

## Overview
File management architecture writing chunks to temporary hidden files and executing atomic filesystem renames upon validation completion, preventing corrupt partial exports.

## Key Principles
1. Enforce strict bounded memory and zero-copy streaming throughout pipeline execution.
2. Maintain decoupled hexagonal boundaries between core domain logic and external I/O adapters.
3. Implement deterministic state machines for error handling, backpressure, and lifecycle transitions.
4. Ensure full cross-platform compatibility across Windows, macOS, Linux, and Android runtimes.

## Architectural Guarantees
- Constant O(1) memory overhead regardless of playlist size or track count.
- Fail-safe recovery from unexpected process termination with zero corrupted artifacts.
