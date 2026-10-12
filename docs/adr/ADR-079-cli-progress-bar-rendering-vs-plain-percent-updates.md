# ADR-079: CLI Progress Bar Rendering vs Plain Percent Updates

## Status
Accepted

## Context
Interactive terminals benefit from visual progress animations, but non-TTY or redirected stdout streams require plain textual progress updates to prevent escape character pollution.

## Decision
Detect TTY stream capability via `process.stderr.isTTY`; render animated carriage-return progress bars for interactive sessions and sparse percentage logs for non-interactive streams.

## Consequences
- Polished user experience in interactive shells.
- Seamless compatibility with log capture utilities, pipes, and background cron runners.
