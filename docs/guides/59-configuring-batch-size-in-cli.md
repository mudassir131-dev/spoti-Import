# Developer Guide 59: Configuring Batch Size in CLI

## Objectives
Step-by-step guidance on configuring batch size in CLI within the Universal Music Import Engine ecosystem.

## Steps
1. Use `--batch-size <size>` or `-b <size>` on `import` command.
2. Select an appropriate chunk size between 1 and 10,000 (default: 100).
3. Monitor streaming chunk flushing on stderr.
