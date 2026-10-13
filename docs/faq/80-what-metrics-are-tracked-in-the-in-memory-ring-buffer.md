# FAQ: What metrics are tracked in the in-memory ring buffer?

## Question
What metrics are tracked in the in-memory ring buffer?

## Answer
The circular ring buffer records batch completion times, network round-trip latencies, tracks processed per second, retry counts, and heap memory usage. These samples allow calculating rolling averages and percentiles for real-time diagnostics.
