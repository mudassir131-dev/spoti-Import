# FAQ: What are the benefits of NDJSON over JSON arrays for streaming?

## Question
What are the benefits of NDJSON over JSON arrays for streaming?

## Answer
Standard JSON arrays require opening and closing brackets, demanding that either the entire array is loaded into RAM or complex streaming tokens are managed. NDJSON formats each record on an isolated line, enabling O(1) line-by-line parsing, append operations, and immediate stream consumption by external tools like jq and grep.
