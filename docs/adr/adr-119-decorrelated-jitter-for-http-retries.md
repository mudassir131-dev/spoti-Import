# ADR-119: Adopt Decorrelated Jitter Algorithm for Spotify HTTP Retry Schedules

## Status
Accepted

## Context
Standard exponential backoff still caused synchronized retry pulses across concurrent batch requests.

## Decision
Apply the Decorrelated Jitter equation (sleep = min(cap, random(base, sleep * 3))) to all HTTP retries.

## Consequences
Evenly distributes retry traffic across time, dramatically reducing repeat 429 response codes.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
