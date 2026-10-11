# Developer Guide 64: Scripting and Exit Code Handling

## Objectives
Step-by-step guidance on scripting and exit code handling within the Universal Music Import Engine ecosystem.

## Steps
1. Capture command exit status using `$?` in bash or `$LASTEXITCODE` in PowerShell.
2. Handle code 0 for success, 1 for runtime errors, 2 for invalid arguments.
3. Handle code 130 for graceful abort handling.
