# FAQ: Does the CLI Log API Tokens

## Question
Does the CLI log API tokens or credentials?

## Answer
No. The CLI strictly enforces a zero-secret-leakage policy, preventing secrets from being printed to stdout or stderr.
