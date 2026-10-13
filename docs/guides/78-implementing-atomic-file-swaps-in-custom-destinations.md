# Developer Guide 78: Implementing Atomic File Swaps in Custom Destinations

## Objectives
Build resilient destination adapters that protect against partial writes and data corruption.

## Steps
1. Direct initial stream writes to `<destination-path>.tmp.<pid>`.
2. Flush all buffered chunk data and calculate file checksum before closing stream.
3. Use `fs.promises.rename()` to swap the temporary file into the final destination atomically.
