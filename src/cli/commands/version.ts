/**
 * Universal Music Import Engine - Version Command
 */

import { CURRENT_SCHEMA_VERSION } from '../../core/domain/constants.js';
import { CliExitCode, type CommandDefinition, type CliIo } from '../types.js';

export const CLI_VERSION = '0.1.0';

export const versionCommand: CommandDefinition = {
  name: 'version',
  description: 'Display CLI version and canonical schema version',
  usage: 'music-import version',
  examples: ['music-import version'],
  execute: async (_args: string[], io: CliIo): Promise<number> => {
    const out = io.stdout ?? ((t) => process.stdout.write(t + '\n'));
    out(`music-import v${CLI_VERSION} (schema v${CURRENT_SCHEMA_VERSION})`);
    return CliExitCode.SUCCESS;
  },
};
