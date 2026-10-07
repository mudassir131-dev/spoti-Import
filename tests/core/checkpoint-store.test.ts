import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryCheckpointStore,
  type ImportCheckpoint,
  type CheckpointStore,
} from '../../src/index.js';

function createSampleCheckpoint(
  importId: string,
  overrides: Partial<ImportCheckpoint> = {}
): ImportCheckpoint {
  const timestamp = new Date().toISOString();
  return {
    importId,
    sourceName: 'spotify-public',
    sourceReference: '37i9dQZF1DXcBWIGoYBM5M',
    processedTracks: 100,
    writtenTracks: 100,
    skippedTracks: 0,
    failedTracks: 0,
    currentBatch: 1,
    currentPage: 1,
    lastProcessedSourceId: 'trk-100',
    isTruncated: false,
    status: 'running',
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: { testKey: 'testValue' },
    ...overrides,
  };
}

describe('CheckpointStore Contract & InMemoryCheckpointStore (PR 1)', () => {
  let store: InMemoryCheckpointStore;

  beforeEach(() => {
    store = new InMemoryCheckpointStore();
  });

  // Test 1: Save & Load
  it('1. Saves and loads an active import checkpoint accurately', async () => {
    const cp = createSampleCheckpoint('job-1');
    await store.save(cp);

    const loaded = await store.load('job-1');
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(cp);
    expect(loaded?.importId).toBe('job-1');
    expect(loaded?.processedTracks).toBe(100);
    expect(loaded?.writtenTracks).toBe(100);
    expect(loaded?.status).toBe('running');
  });

  // Test 2: Update checkpoint
  it('2. Updates an existing checkpoint with new progress information', async () => {
    const initial = createSampleCheckpoint('job-2', {
      processedTracks: 50,
      writtenTracks: 50,
      currentBatch: 1,
    });
    await store.save(initial);

    const updated: ImportCheckpoint = {
      ...initial,
      processedTracks: 150,
      writtenTracks: 150,
      currentBatch: 2,
      lastProcessedSourceId: 'trk-150',
      updatedAt: new Date().toISOString(),
    };
    await store.save(updated);

    const loaded = await store.load('job-2');
    expect(loaded).not.toBeNull();
    expect(loaded?.processedTracks).toBe(150);
    expect(loaded?.writtenTracks).toBe(150);
    expect(loaded?.currentBatch).toBe(2);
    expect(loaded?.lastProcessedSourceId).toBe('trk-150');
  });

  // Test 3: Delete checkpoint
  it('3. Deletes an existing checkpoint upon completion or cleanup', async () => {
    const cp = createSampleCheckpoint('job-3');
    await store.save(cp);
    expect(await store.load('job-3')).not.toBeNull();

    await store.delete('job-3');
    const loadedAfterDelete = await store.load('job-3');
    expect(loadedAfterDelete).toBeNull();
  });

  // Test 4: Missing checkpoint returns null
  it('4. Returns null when attempting to load a non-existent checkpoint', async () => {
    const result = await store.load('non-existent-job-id');
    expect(result).toBeNull();
  });

  // Test 5: Multiple import IDs remain strictly isolated
  it('5. Maintains strict data isolation across distinct import IDs', async () => {
    const cpA = createSampleCheckpoint('job-A', {
      sourceReference: 'playlist-alpha',
      processedTracks: 200,
    });
    const cpB = createSampleCheckpoint('job-B', {
      sourceReference: 'playlist-beta',
      processedTracks: 500,
    });

    await store.save(cpA);
    await store.save(cpB);

    expect(store.size()).toBe(2);

    const loadedA = await store.load('job-A');
    const loadedB = await store.load('job-B');

    expect(loadedA?.sourceReference).toBe('playlist-alpha');
    expect(loadedA?.processedTracks).toBe(200);

    expect(loadedB?.sourceReference).toBe('playlist-beta');
    expect(loadedB?.processedTracks).toBe(500);

    // Deleting A does not impact B
    await store.delete('job-A');
    expect(await store.load('job-A')).toBeNull();
    expect(await store.load('job-B')).not.toBeNull();
    expect(store.size()).toBe(1);
  });

  // Test 6: Deep clone guarantee prevents reference mutation
  it('6. Preserves immutable snapshot semantics against caller reference mutations', async () => {
    const original = createSampleCheckpoint('job-clone-test');
    await store.save(original);

    // Mutate local reference after save
    (original as any).processedTracks = 999999;
    (original as any).status = 'failed';

    const loaded = await store.load('job-clone-test');
    expect(loaded?.processedTracks).toBe(100);
    expect(loaded?.status).toBe('running');

    // Mutate loaded reference
    (loaded as any).processedTracks = 888888;
    const loadedAgain = await store.load('job-clone-test');
    expect(loadedAgain?.processedTracks).toBe(100);
  });

  // Test 7: Port contract polymorphic verification
  it('7. Implements CheckpointStore port contract cleanly', () => {
    const genericStore: CheckpointStore = store;
    expect(typeof genericStore.save).toBe('function');
    expect(typeof genericStore.load).toBe('function');
    expect(typeof genericStore.delete).toBe('function');
  });
});
