# Developer Guide 79: Configuring In-Memory Artist LRU Cache

## Objectives
Optimize API request budgets by configuring the internal artist metadata cache.

## Steps
1. Set the cache size limit in your engine configuration using `artistCacheSize: 1000`.
2. Verify cache hit ratios using telemetry event listeners during test runs.
3. Clear cache explicitly between distinct import batches when memory headroom is constrained.
