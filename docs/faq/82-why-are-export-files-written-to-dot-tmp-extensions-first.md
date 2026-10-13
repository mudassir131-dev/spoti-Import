# FAQ: Why are export files written to .tmp extensions first?

## Question
Why are export files written to .tmp extensions first?

## Answer
Writing to temporary files prevents consumers from reading half-written or corrupted exports if the process terminates unexpectedly. Once all tracks are written and validated, the temporary file is atomically renamed to its target path.
