# Universal Music Import Engine

A reusable, production-grade Universal Music Import Engine built using **Ports & Adapters (Hexagonal Architecture)** in strict TypeScript and Node.js LTS (ESM).

The engine is platform-agnostic: it orchestrates the ingestion, validation, normalization, batching, and persistence lifecycle across arbitrary music sources and storage sinks without coupling to specific platforms.

---

## Architecture: Ports & Adapters (Hexagonal Architecture)

The core domain and engine operate purely against abstract interfaces (**ports**). Real-world platforms (Spotify, Apple Music, SQLite/Room, PostgreSQL, Redis, HTTP servers, CLI tools) reside on the outer perimeter as **adapters**.

```
                         +-----------------------------+
                         |      External Clients       |
                         +--------------+--------------+
                                        |
                                        v
+------------------+         +--------------------+         +-----------------------+
|  Music Source    |  ====>  |    ImportEngine    |  ====>  |   Music Destination   |
| (Secondary Port) |         |  (Core Domain &    |         |   (Secondary Port)    |
|                  |         |   Application)     |         |                       |
+------------------+         +--------------------+         +-----------------------+
        ^                                                               ^
        |                                                               |
+-------+--------------+                                        +-------+---------------+
| Infrastructure       |                                        | Infrastructure        |
| Adapters:            |                                        | Adapters:             |
| - InMemorySource     |                                        | - InMemoryDestination |
| - (Spotify in Ph.2)  |                                        | - (Room in Ph.4)      |
+----------------------+                                        +-----------------------+
```

### Dependency Direction

```
Infrastructure Adapters  ───▶  Core Ports  ◀───  Core Engine / Domain
```

- **Inward Dependency Rule**: All dependencies point strictly inward toward the core domain.
- **Pure Core**: The core imports no infrastructure code, external platform SDKs, database drivers, or transport layers.
- **Port Contracts**: Infrastructure adapters depend directly on core ports and domain models, never the reverse.

---

## Directory Structure

```
src/
  core/
    domain/             # Pure domain entities, Zod schemas, constants, typed errors
      constants.ts      # MAX_IMPORT_TRACKS (10,000) & DEFAULT_BATCH_SIZE (100)
      errors.ts         # Structured, machine-readable ImportError hierarchy
      models.ts         # ImportedTrack, ImportedAlbum, ImportedArtist, ImportedPlaylist, etc.
      index.ts
    ports/              # Abstract ports (contracts for sources and destinations)
      music-source.ts   # MusicSource interface (getPlaylist, getTracks)
      music-destination.ts # MusicDestination interface (writeTracks, commit, rollback)
      track-normalizer.ts  # TrackNormalizer interface
      index.ts
    services/           # Orchestration and lifecycle coordination
      default-track-normalizer.ts # Normalization & validation service
      import-engine.ts  # ImportEngine lifecycle service
      index.ts
  infrastructure/       # Outermost adapter implementations
    memory/             # In-memory reference adapters (InMemoryMusicSource, InMemoryMusicDestination)
    index.ts
  index.ts              # Stable public API gateway

tests/
  core/                 # Unit and contract tests
    import-engine.test.ts
    domain-validation.test.ts
    in-memory-adapters.test.ts
```

---

## Core Concepts

### 1. Domain Entities & Schemas
- **`ImportedTrack`**: Canonical track representation with source metadata, artists, album, duration, ISRC, track/disc numbers, explicit flag, artwork, and arbitrary metadata bag.
- **`ImportedAlbum`** & **`ImportedArtist`**: Normalized metadata entities.
- **`ImportedPlaylist`**: Source-agnostic playlist entity.
- **`ImportJob`**: Tracks execution state (`pending`, `running`, `completed`, `failed`, `cancelled`), timestamps, and error payloads.
- **`ImportProgress`**: Real-time progress metrics (`processedTracks`, `writtenTracks`, `currentBatch`, `totalBatches`, `status`).

### 2. Centralized Safety Limits & Batching
- **`MAX_IMPORT_TRACKS = 10_000`**: Hard safety limit defined in `src/core/domain/constants.ts`. The architecture prevents callers from requesting more than 10,000 tracks via both upfront schema validation (`ImportLimitError`) and stream truncation.
- **`DEFAULT_BATCH_SIZE = 100`**: Centralized default batch size. Can be overridden per request or engine instance without exceeding the safety ceiling.

### 3. Structured Error Model
Typed domain errors inheriting from `ImportError`:
- **`ValidationError`**: Invalid requests, parameters, or corrupt track entities.
- **`SourceError`**: External source read failures (captures source name, operation, and underlying cause).
- **`DestinationError`**: Target storage write, commit, or rollback failures.
- **`ImportLimitError`**: Safety ceiling breaches (`requestedLimit`, `maxAllowed`).
- **`ImportCancelledError`**: Graceful handling of abort signals (`AbortSignal`).

Every error provides a machine-readable payload via `.toJSON()` containing `code`, `message`, `details`, and ISO `timestamp`.

### 4. ImportEngine Lifecycle
The engine coordinates the 7-step lifecycle:
1. **Validate import request**: Ensures valid IDs, bounds batch sizes, checks 10,000-track safety limit, verifies `AbortSignal`.
2. **Create ImportJob**: Initializes execution record with unique UUID.
3. **Fetch source records**: Invokes `MusicSource.getPlaylist` and `MusicSource.getTracks`.
4. **Normalize records**: Converts raw source payloads into validated `ImportedTrack` entities via `TrackNormalizer`.
5. **Send batches to destination**: Splits tracks into batches, writes via `MusicDestination.writeTracks`, updates progress, and invokes `commit`. On failure, executes `rollback`.
6. **Update ImportProgress**: Emits progress updates at each stage.
7. **Complete or Return Error**: Finalizes job status and returns structured result or throws typed error.

---

## Getting Started

### Prerequisites
- Node.js LTS (v20+ or v24+)
- npm 10+

### Installation

```bash
npm install
```

### Type Checking

```bash
npm run typecheck
```

### Running Tests

```bash
npm test
```


---

## What is Intentionally NOT Implemented Yet (Phase 1 Boundary)

In accordance with Phase 1 design constraints, the following components are explicitly reserved for subsequent phases:

- ❌ **Spotify Web API & OAuth**: No live Spotify API calls or OAuth flows.
- ❌ **Real Pagination Loop**: Pagination cursors and page-by-page streaming will be implemented in Phase 3.
- ❌ **Room / SQLite / PostgreSQL / Redis Persistence**: Database storage adapters are deferred.
- ❌ **BullMQ / Background Queues**: Background worker orchestration will be built in later phases.
- ❌ **HTTP / CLI Surface**: Transport layers will be exposed on top of the core engine in future milestones.
