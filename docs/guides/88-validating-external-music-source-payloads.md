# Developer Guide 88: Validating External Music Source Payloads

## Objectives
Debug and test external music source payloads using the CLI inspect tool.

## Steps
1. Run schema inspection on local JSON or raw source payload: `music-import inspect <payload.json>`.
2. Review field-by-field validation results against `ImportedTrackSchema`.
3. Fix identified validation errors before feeding payload into production pipeline.
