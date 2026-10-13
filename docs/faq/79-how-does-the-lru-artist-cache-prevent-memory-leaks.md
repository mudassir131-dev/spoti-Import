# FAQ: How does the LRU artist cache prevent memory leaks?

## Question
How does the LRU artist cache prevent memory leaks?

## Answer
Unbounded caches grow indefinitely as more tracks are processed. The LRU cache enforces a strict capacity limit (e.g. 5,000 entries), automatically discarding the least recently used artist entries when full. This bounds heap allocation to a constant size regardless of playlist length.
