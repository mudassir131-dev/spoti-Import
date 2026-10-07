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

## Spotify Setup Guide (Phase 2)

The Spotify integration provides an infrastructure-level source adapter and authentication layer.

> [!IMPORTANT]
> Real credentials must **NEVER** be committed to the repository or stored in source code. Credentials belong strictly in environment variables.

### 1. Create a Spotify Developer Application
1. Log in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create a new app and note your **Client ID** and **Client Secret**.

### 2. Configure Redirect URI
1. In your app settings on the Spotify Developer Dashboard, navigate to **Redirect URIs**.
2. Add your application callback URI (e.g., `http://localhost:3000/callback`).

### 3. Copy Environment Template
Copy the example file to a local `.env` file (which is git-ignored):

```bash
cp .env.example .env
```

### 4. Fill Credentials Locally
Open `.env` and fill in your credentials using environment variables:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

### 5. Start the OAuth Flow
Generate a cryptographically secure CSRF `state` and create the authorization URL using the minimal required scopes (`playlist-read-private`, `playlist-read-collaborative`):

```typescript
import {
  loadSpotifyConfigFromEnv,
  SpotifyOAuthService,
} from 'universal-music-import-engine';

const config = loadSpotifyConfigFromEnv();
const oauthService = new SpotifyOAuthService({ config });

// Caller generates and stores state in session/cookie for CSRF validation
const state = crypto.randomUUID();
const authUrl = oauthService.createAuthorizationUrl({ state });
// Redirect user to authUrl
```

### 6. Handle the Callback & Verify State
When the user authorizes and Spotify redirects to your callback URL with `code` and `state`:

```typescript
// Verify that the returned state matches the stored state
oauthService.verifyState(expectedState, receivedState);
```

### 7. Exchange Authorization Code for Tokens
Exchange the one-time code for a token pair (`accessToken` and `refreshToken`):

```typescript
const token = await oauthService.exchangeCodeForToken(code);

// Pass token to SpotifyTokenManager and SpotifyHttpClient
const tokenManager = new SpotifyTokenManager({
  initialToken: token,
  oauthService,
});

const client = new SpotifyHttpClient({ tokenProvider: tokenManager });
const spotifySource = new SpotifyMusicSource(client);
```

---

## What is Intentionally NOT Implemented Yet (Phase 2 Boundary)

In accordance with Phase 2 design constraints, the following components are explicitly reserved for subsequent phases:

- ❌ **Real Playlist Pagination Loop**: Page-by-page fetching and pagination cursors are deferred to Phase 3.
- ❌ **10,000-Track Ingestion Engine**: Large-scale streaming pipeline is deferred to Phase 3.
- ❌ **Persistent Destination Adapters**: Room, SQLite, PostgreSQL, and filesystem sink adapters are deferred to Phase 4.
- ❌ **Background Queue & Workers**: Redis, BullMQ, and job scheduling are deferred to future milestones.
- ❌ **CLI & HTTP Servers**: Transport and interface layers will be implemented in later phases.
- ❌ **Audio Downloading & External Platforms**: No YouTube, Apple Music, or audio stream scraping.

