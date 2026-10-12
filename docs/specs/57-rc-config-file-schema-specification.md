# Technical Specification: RC Config File Schema

## Standard
Formal technical specification for RC config file schema.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Configuration file must parse as valid JSON.
2. Recognized keys must match command options (format, batchSize, bom, deduplicate).
3. CLI options passed via argv must override RC file options.
