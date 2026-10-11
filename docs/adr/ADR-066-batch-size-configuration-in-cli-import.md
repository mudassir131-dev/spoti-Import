# ADR-066: Batch Size Configuration in CLI Import

## Status
Accepted

## Context
Different network and disk environments may perform optimally with different batch chunk sizes (e.g. 50 vs 200).

## Decision
Expose the `--batch-size` (`-b`) flag on the `import` command, validating that the input is an integer between 1 and 10,000.

## Consequences
- Configurable memory and throughput tuning for varied hardware.
- Safe fallback to default batch size (100) when omitted.
