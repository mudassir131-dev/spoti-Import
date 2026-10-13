# FAQ: What Prevents Half-Written Export Files During Crashes?

## Question
What prevents half-written export files during crashes?

## Answer
The engine employs an atomic write pattern: outputs stream into an isolated temporary file (`.tmp.[pid]`) and are atomically renamed to the final destination only after complete, successful flush.
