# ADR-111: Adopt Token Bucket Rate Limiter with Burst Tolerance for Spotify API

## Status
Accepted

## Context
Fixed delay throttling resulted in sub-optimal throughput during short network bursts and triggered 429s during rapid paging.

## Decision
Implement a Token Bucket algorithm allowing configurable burst capacity with continuous steady-state token replenishment.

## Consequences
Maximizes API throughput while respecting Spotify rate limits and avoiding costly 429 backoff delays.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
