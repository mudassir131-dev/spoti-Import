# Developer Guide 83: Handling SIGINT and SIGTERM Signals in CLI

## Objectives
Properly intercept and test interrupt signals in automation and shell scripts.

## Steps
1. Initiate a long-running import in background process or test shell.
2. Send termination signal using `kill -SIGINT <pid>` or pressing Ctrl+C.
3. Observe clean checkpoint state flush and verify exit status code 130.
