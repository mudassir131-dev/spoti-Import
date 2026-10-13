# FAQ: Why does the engine dynamically adjust batch sizes?

## Question
Why does the engine dynamically adjust batch sizes?

## Answer
Fixed batch sizes can cause memory spikes when track records contain heavy embedded metadata (such as high-res album art or extended contributor lists). By dynamically scaling down batch sizes under memory pressure, the engine preserves steady throughput without triggering V8 heap exhaustion.
