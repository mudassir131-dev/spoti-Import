# FAQ: Why is decorrelated jitter better than fixed backoff alone?

## Question
Why is decorrelated jitter better than fixed backoff alone?

## Answer
Fixed backoff causes multiple concurrent retries to synchronize into periodic spikes (thundering herds), repeatedly hitting rate limits. Decorrelated jitter randomizes delays across a broad time window, smoothing request load and significantly improving recovery rates.
