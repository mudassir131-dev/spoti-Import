# FAQ: Why Use Decorrelated Jitter Instead of Fixed Backoff?

## Question
Why use decorrelated jitter instead of fixed backoff?

## Answer
Fixed backoff intervals cause retrying clients to repeatedly collide with rate limits in synchronized lockstep bursts. Decorrelated jitter randomizes delay distribution to clear congestion effectively.
