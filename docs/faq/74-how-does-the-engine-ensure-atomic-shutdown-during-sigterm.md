# FAQ: How does the engine ensure atomic shutdown during SIGTERM?

## Question
How does the engine ensure atomic shutdown during SIGTERM?

## Answer
Upon intercepting a SIGINT or SIGTERM signal, the engine triggers an internal AbortController, marks the lifecycle state as CANCELLING, flushes in-flight write buffers, commits the latest checkpoint, and returns a standard POSIX 130 exit code within 500ms.
