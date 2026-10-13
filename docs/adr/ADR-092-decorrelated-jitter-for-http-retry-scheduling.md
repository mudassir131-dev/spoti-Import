# ADR-092: Decorrelated Jitter for HTTP Retry Scheduling

## Status
Accepted

## Context
High volume API requests against rate-limited Spotify endpoints can produce clustered request spikes when using standard exponential backoff.

## Decision
Adopt decorrelated jitter calculation where next retry delay is randomized between base backoff and three times the prior delay interval.

## Consequences
- Significantly reduces burst collisions and secondary HTTP 429 rate limit responses.
- Increases overall completion rate for large playlist imports over unstable networks.
