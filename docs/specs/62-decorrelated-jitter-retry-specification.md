# Technical Specification 62: Decorrelated Jitter Retry Algorithm

## Standard
Formal specification for network request retry scheduling under congestion and rate limiting.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Base sleep interval must not fall below 250 milliseconds.
2. Maximum sleep ceiling must not exceed 30 seconds.
3. Delays must be computed using decorrelated jitter: sleep = min(maxCeiling, rand(base, sleep * 3)).
