# Architecture Note 75: CLI Progress Bar Terminal Render Loop

## Overview
Comprehensive architectural specification for the CLI progress bar terminal render loop within the Universal Music Import Engine.

## Key Principles
1. Non-blocking terminal refresh throttled to 60fps to eliminate CPU contention.
2. Dynamic width adjustment according to terminal column dimension.
3. Smooth fallback to percentage logging when piped or running in non-TTY mode.
4. Clean cursor restoration upon completion, interruption, or unhandled errors.
