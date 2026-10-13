# Developer Guide 89: Preventing Credential Leaks in CLI Logs

## Objectives
Audit and secure CLI logging configurations to meet enterprise compliance standards.

## Steps
1. Enable verbose logging for debugging: `--log-level debug`.
2. Inspect output logs to verify authorization tokens display as `[REDACTED]`.
3. Run automated credential scanner tests prior to committing log files or scripts.
