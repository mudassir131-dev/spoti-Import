# Developer Guide 77: Tuning HTTP Retry Backoff and Jitter

## Objectives
Configure retry parameters to handle rate limiting and network instability reliably.

## Steps
1. Adjust the maximum retry count with `--max-retries 5`.
2. Configure initial retry interval with `--retry-base-ms 500`.
3. Enable decorrelated jitter algorithm in configuration to prevent thundering herd collisions.
