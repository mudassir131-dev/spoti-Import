# Developer Guide 84: Interpreting CLI Exit Codes in Scripts

## Objectives
Integrate the CLI cleanly into CI/CD pipelines and shell automation.

## Steps
1. Capture exit status in Bash (`$?`) or PowerShell (`$LASTEXITCODE`).
2. Implement branching logic: code 0 (success), 2 (bad args), 3 (auth failure), 4 (rate limited).
3. Schedule delayed retries specifically when exit code 4 is received.
