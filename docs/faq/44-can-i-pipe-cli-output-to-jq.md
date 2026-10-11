# FAQ: Can I Pipe CLI Output to JQ

## Question
Can I pipe CLI output directly into jq?

## Answer
Yes. Omit `--out` or specify `-o -`. Output JSON is written to stdout, while progress information stays on stderr.
