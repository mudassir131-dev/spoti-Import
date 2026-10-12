# FAQ: Can I Export to Newline-Delimited JSON (NDJSON)?

## Question
Can I export directly to Newline-Delimited JSON (NDJSON / .jsonl)?

## Answer
Yes. Specify `-f ndjson` or `--format ndjson`. Each track is written as a discrete JSON line, ideal for streaming pipelines.
