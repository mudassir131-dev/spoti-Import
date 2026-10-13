# FAQ: How does the token bucket prevent HTTP 429 Too Many Requests errors?

## Question
How does the token bucket prevent HTTP 429 Too Many Requests errors?

## Answer
The token bucket smooths out rapid request bursts by permitting a controlled burst count while replenishing tokens at a sustained rate matching Spotify API limits. Requests that exceed token capacity are paused asynchronously rather than failing immediately.
