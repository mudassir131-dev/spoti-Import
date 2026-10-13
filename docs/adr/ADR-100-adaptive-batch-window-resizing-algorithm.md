# ADR-100: Adaptive Batch Window Resizing Algorithm

## Status
Accepted

## Context
Static batch sizing is suboptimal across varying network bandwidths and host memory constraints.

## Decision
Implement dynamic batch window sizing that scales between 25 and 500 tracks based on rolling API request response latency.

## Consequences
- Automatically optimizes throughput on high-speed fiber connections while preventing timeouts on high-latency mobile networks.
- Enforces strict minimum and maximum safety bounds.
