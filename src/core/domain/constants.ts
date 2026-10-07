/**
 * Universal Music Import Engine - Centralized Domain Constants
 */

/**
 * Hard safety ceiling on the maximum number of tracks permitted in a single import operation.
 * The architecture enforces this limit to prevent accidental unbounded memory or API consumption.
 */
export const MAX_IMPORT_TRACKS = 10_000;

/**
 * Default number of tracks processed and written to destinations in a single batch.
 */
export const DEFAULT_BATCH_SIZE = 100;
