# FAQ: How Does the Engine Handle Partial Network Failures?

## Question
How does the engine handle partial network failures during long-running imports?

## Answer
The engine applies exponential backoff with jitter up to the configured retry limit and saves checkpoint state so interrupted runs can resume seamlessly.
