# FAQ: Why is a write-ahead log used for checkpoints?

## Question
Why is a write-ahead log used for checkpoints?

## Answer
In-place file updates can corrupt checkpoint state if a crash happens midway through writing. Appending transaction records to a write-ahead log guarantees that past records remain valid and uncorrupted, allowing the engine to reliably reconstruct the exact point of interruption upon restart.
