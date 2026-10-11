# ADR-073: Packaging Bin Script and NPM Link Compatibility

## Status
Accepted

## Context
The CLI must be executable both locally in development via `npm run cli` and globally via `npm link` or global package installation.

## Decision
Configure `package.json` with `"bin": { "music-import": "./dist/src/cli/bin.js" }` and include a standard shebang (`#!/usr/bin/env node`) in `bin.ts`.

## Consequences
- Global command `music-import` is directly executable upon installation.
- Preserves seamless local development execution workflow.
