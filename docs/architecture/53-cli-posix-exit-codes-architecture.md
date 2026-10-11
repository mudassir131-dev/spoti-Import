# Architecture Note 53: CLI POSIX Exit Codes Architecture

## Overview
Comprehensive architectural specification for CLI POSIX exit codes architecture within the Universal Music Import Engine.

## Key Principles
1. Strict differentiation between operational errors (1) and syntax errors (2).
2. SIGINT / AbortSignal mapping to exit code 130.
3. Zero exit code for successful runs.
4. Predictable script integration guarantees.
