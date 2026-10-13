# FAQ: How can I profile memory growth during large migrations?

## Question
How can I profile memory growth during large migrations?

## Answer
You can run the CLI with the NODE_OPTIONS="--max-old-space-size=128" flag and enable the --profile flag. The engine will sample heap statistics at regular batch intervals and emit memory diagnostic graphs upon completion.
