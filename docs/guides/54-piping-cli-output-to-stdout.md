# Developer Guide 54: Piping CLI Output to Stdout

## Objectives
Step-by-step guidance on piping CLI output to stdout within the Universal Music Import Engine ecosystem.

## Steps
1. Omit the `--out` flag or specify `-o -`.
2. Pipe stdout to downstream tools like `jq` or file redirects.
3. Diagnostic messages will remain cleanly on `stderr`.
