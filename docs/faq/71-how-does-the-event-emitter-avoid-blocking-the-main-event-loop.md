# FAQ: How does the event emitter avoid blocking the main event loop?

## Question
How does the event emitter avoid blocking the main event loop?

## Answer
Event emissions in the engine are asynchronous and scheduled using queueMicrotask or setImmediate. This decouples event listener execution from the critical batch processing loop, ensuring that UI updates or logging never impede stream ingestion throughput.
