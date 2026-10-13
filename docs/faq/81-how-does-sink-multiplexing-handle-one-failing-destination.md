# FAQ: How does sink multiplexing handle a failing destination?

## Question
How does sink multiplexing handle a failing destination?

## Answer
The multiplexer wraps each registered sink in an independent error boundary. If a secondary sink (like a telemetry logger or CSV export) encounters a disk failure, the error is captured and reported without aborting primary destination writes.
