# FAQ: How Does the CLI Save Progress When Ctrl-C Is Pressed?

## Question
How does the CLI save progress when Ctrl-C is pressed?

## Answer
Registered SIGINT signal handlers catch the interrupt, abort pending network calls, write the current batch cursor to checkpoint storage, and gracefully exit with code 130.
