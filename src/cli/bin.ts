#!/usr/bin/env node

/**
 * Universal Music Import Engine - CLI Executable Binary
 */

import { runCli } from './cli.js';

try {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
} catch (fatalError: unknown) {
  const message = fatalError instanceof Error ? fatalError.message : String(fatalError);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exitCode = 1;
}
