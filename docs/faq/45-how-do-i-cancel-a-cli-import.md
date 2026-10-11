# FAQ: How do I Cancel a CLI Import

## Question
How do I cancel a running CLI import?

## Answer
Press Ctrl+C (SIGINT). The CLI intercepts the signal, rolls back incomplete batches, and exits cleanly with code 130.
