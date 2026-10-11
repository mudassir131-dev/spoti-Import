/**
 * Universal Music Import Engine - CLI Help Formatter
 */

import type { CommandDefinition } from './types.js';

export function formatRootHelp(commands: ReadonlyArray<CommandDefinition>): string {
  const lines: string[] = [
    'Universal Music Import Engine CLI',
    '',
    'USAGE:',
    '  music-import <command> [options] [arguments]',
    '  music-import [flags]',
    '',
    'COMMANDS:',
  ];

  const maxCmdLength = Math.max(...commands.map((c) => c.name.length), 8);

  for (const cmd of commands) {
    const padded = cmd.name.padEnd(maxCmdLength + 2, ' ');
    lines.push(`  ${padded}${cmd.description}`);
  }

  lines.push('');
  lines.push('GLOBAL FLAGS:');
  lines.push('  -h, --help       Show help for command or CLI');
  lines.push('  -v, --version    Show CLI version');
  lines.push('');
  lines.push('Run "music-import <command> --help" for more information on a specific command.');

  return lines.join('\n');
}

export function formatCommandHelp(cmd: CommandDefinition): string {
  const lines: string[] = [
    `music-import ${cmd.name} - ${cmd.description}`,
    '',
    'USAGE:',
    `  ${cmd.usage}`,
  ];

  if (cmd.options && Object.keys(cmd.options).length > 0) {
    lines.push('');
    lines.push('OPTIONS:');
    const optEntries = Object.entries(cmd.options);
    const maxOptLength = Math.max(
      ...optEntries.map(([name, opt]) => {
        const flag = opt.short ? `-${opt.short}, --${name}` : `--${name}`;
        return flag.length;
      }),
      10
    );

    for (const [name, opt] of optEntries) {
      const flag = opt.short ? `-${opt.short}, --${name}` : `--${name}`;
      const padded = flag.padEnd(maxOptLength + 2, ' ');
      const def = opt.default !== undefined ? ` [default: ${String(opt.default)}]` : '';
      const req = opt.required ? ' [required]' : '';
      lines.push(`  ${padded}${opt.description}${def}${req}`);
    }
  }

  if (cmd.examples && cmd.examples.length > 0) {
    lines.push('');
    lines.push('EXAMPLES:');
    for (const example of cmd.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join('\n');
}
