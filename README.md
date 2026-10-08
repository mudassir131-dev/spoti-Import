<p align="center">
  <img src="assets/logo.png" alt="Spoti Import Logo" width="240"/>
</p>

<h1 align="center">Spoti Import</h1>

<p align="center">
  <strong>Universal Music Import Engine</strong><br/>
  <em>A production-grade, extensible, platform-agnostic music ingestion engine built with strict Hexagonal Architecture (Ports &amp; Adapters) in TypeScript and Node.js LTS.</em>
</p>

<p align="center">
  <a href="#-architecture--deep-dive"><img src="https://img.shields.io/badge/Architecture-Hexagonal%20%2F%20Ports%20%26%20Adapters-8B5CF6?style=for-the-badge&logo=blueprint" alt="Hexagonal Architecture"/></a>
  <a href="#-verification--testing"><img src="https://img.shields.io/badge/TypeScript-Strict%20ESM-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript Strict"/></a>
  <a href="#-verification--testing"><img src="https://img.shields.io/badge/Tests-76%20Passed%20%7C%20Vitest-10B981?style=for-the-badge&logo=vitest" alt="Vitest Passed"/></a>
  <a href="#-security--credentials"><img src="https://img.shields.io/badge/Security-Zero%20Secrets%20in%20Repo-EF4444?style=for-the-badge&logo=security" alt="Security"/></a>
  <a href="#-license"><img src="https://img.shields.io/badge/License-GNU%20GPL%20v3-F59E0B?style=for-the-badge&logo=gnu" alt="GNU GPL v3 License"/></a>
</p>

---

## ⚠️ Disclaimer & Notice of Educational Use

> [!IMPORTANT]
> **FOR EDUCATIONAL, RESEARCH, AND PERSONAL USE ONLY**
>
> This repository, **Spoti Import (Universal Music Import Engine)**, is an open-source software project distributed strictly for **educational, learning, and personal non-commercial use**.
>
> - **Educational Purpose**: Built as an architectural study in Hexagonal Architecture (Ports & Adapters), strict TypeScript domain modeling, and robust API lifecycle management.
> - **Non-Commercial**: This software is not intended for commercial exploitation or for circumventing licensing terms.
> - **Independent Project**: This project is not affiliated, sponsored, associated, or endorsed by Spotify AB, Spotify Technology S.A., or any related entities. "Spotify" and associated trademarks belong to their respective owners.
> - **API Terms of Service**: Users must supply their own developer credentials from the Spotify Developer Dashboard and are solely responsible for adhering to the [Spotify Developer Terms of Service](https://developer.spotify.com/terms) and their local copyright and data laws.
> - **No Audio Piracy**: This engine only imports metadata (playlist titles, track metadata, artist names, album art URLs, and ISRC codes) for personal library organization. It does not download audio streams, rip music files, or bypass DRM protections.

---

## 🏛️ Deeply Described Architecture

**Spoti Import** is designed around **Ports & Adapters (Hexagonal Architecture)**. The primary objective is absolute isolation between business domain rules and infrastructure technologies.

The core engine operates entirely on universal abstractions (**ports**). Real-world third-party platforms (Spotify, Apple Music, Tidal), persistence engines (Room SQLite, PostgreSQL, Memory), cache layers (Redis, BullMQ), and transport interfaces (HTTP, CLI) reside exclusively on the perimeter as interchangeable **adapters**.

---

### Figure 1: Hexagonal Architecture & Inward Dependency Boundary

The following figure depicts the hexagonal boundary, separating core domain logic from outward-facing secondary adapters:

```mermaid
graph TD
    subgraph External_World["🌍 External World & Transports"]
        UI["CLI / HTTP Server / Mobile App"]
    end

    subgraph Hexagonal_Core["📦 CORE APPLICATION (Decoupled & Pure)"]
        subgraph Ports_In["Driving (Primary) Ports"]
            EngineAPI["ImportEngine Lifecycle Service"]
        end

        subgraph Domain_Core["Domain Entities & Rules"]
            Track["ImportedTrack"]
            Playlist["ImportedPlaylist"]
            Job["ImportJob"]
            Progress["ImportProgress"]
            Errors["Typed ImportError Hierarchy"]
            Safety["MAX_IMPORT_TRACKS = 10,000<br/>DEFAULT_BATCH_SIZE = 100"]
        end

        subgraph Ports_Out["Driven (Secondary) Ports"]
            SourcePort["MusicSource Port<br/>(getPlaylist, getTracks)"]
            DestPort["MusicDestination Port<br/>(writeTracks, commit, rollback)"]
            NormPort["TrackNormalizer Port"]
        end
    end

    subgraph Infrastructure_Adapters["🔌 INFRASTRUCTURE ADAPTERS (Outer Layer)"]
        subgraph Source_Adapters["Source Adapters"]
            SpotifyAdapter["SpotifyMusicSource (Phase 2)"]
            SpotifyClient["SpotifyHttpClient (Native Fetch)"]
            SpotifyTokenMgr["SpotifyTokenManager (Lazy Refresh)"]
            SpotifyOAuth["SpotifyOAuthService (CSRF State)"]
            InMemorySrc["InMemoryMusicSource (Testing)"]
        end

        subgraph Destination_Adapters["Destination Adapters"]
            InMemoryDest["InMemoryMusicDestination"]
            FutureRoom["Room / SQLite Sink (Phase 4)"]
            FuturePostgres["PostgreSQL Sink (Phase 4)"]
        end
    end

    UI -->|Invokes| EngineAPI
    EngineAPI --> Domain_Core
    EngineAPI -->|Calls| SourcePort
    EngineAPI -->|Calls| DestPort
    EngineAPI -->|Calls| NormPort

    SpotifyAdapter -.->|Implements| SourcePort
    SpotifyAdapter --> SpotifyClient
    SpotifyClient --> SpotifyTokenMgr
    SpotifyTokenMgr --> SpotifyOAuth

    InMemorySrc -.->|Implements| SourcePort
    InMemoryDest -.->|Implements| DestPort
    FutureRoom -.->|Implements| DestPort
    FuturePostgres -.->|Implements| DestPort

    style Hexagonal_Core fill:#0d1117,stroke:#8B5CF6,stroke-width:3px,color:#ffffff
    style Domain_Core fill:#161b22,stroke:#3B82F6,stroke-width:2px,color:#ffffff
    style Infrastructure_Adapters fill:#090d16,stroke:#F59E0B,stroke-width:2px,color:#ffffff
```

#### Core Architectural Laws:
1. **The Inward Dependency Rule**: All code dependencies point inward toward the core. Core modules never import from `infrastructure/`.
2. **Protocol Agnosticism**: The core does not know about HTTP status codes, OAuth scopes, Spotify JSON structures, SQLite tables, or Redis queues.
3. **Plug-and-Play Swappability**: Any music source adapter (e.g. Spotify, Apple Music, CSV, local files) can be plugged in without changing a single line of core logic.

---

### Figure 2: The 7-Stage Universal Import Lifecycle Pipeline

The Import Engine coordinates data ingestion through a deterministic 7-stage lifecycle with transactional safety guarantees:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Caller / Client
    participant Engine as ImportEngine
    participant Validator as Zod / Boundary Validator
    participant Source as MusicSource (e.g. Spotify)
    participant Normalizer as TrackNormalizer
    participant Destination as MusicDestination (e.g. Memory / DB)
    participant Progress as Progress Observer

    Client->>Engine: importPlaylist(request)
    activate Engine
    
    rect rgb(26, 32, 44)
    note right of Engine: Stage 1: Request Validation
    Engine->>Validator: Validate playlistId, batchSize & safety ceiling
    alt limit > 10,000
        Engine-->>Client: Return / Throw ImportLimitError
    end
    end

    rect rgb(30, 41, 59)
    note right of Engine: Stage 2: Create ImportJob
    Engine->>Engine: Generate unique UUID & initialize job (status: running)
    Engine->>Progress: Emit initial progress snapshot
    end

    rect rgb(30, 27, 75)
    note right of Engine: Stage 3: Fetch Source Records
    Engine->>Source: getPlaylist(playlistId)
    Source-->>Engine: ImportedPlaylist metadata
    Engine->>Source: getTracks(playlistId, { limit: boundedLimit })
    Source-->>Engine: SourceTrackPage (raw / page items)
    end

    rect rgb(20, 45, 60)
    note right of Engine: Stage 4: Canonical Track Normalization
    loop For each source track item
        Engine->>Normalizer: normalize(rawRecord)
        Normalizer-->>Engine: Validated ImportedTrack domain entity
    end
    end

    rect rgb(45, 20, 50)
    note right of Engine: Stage 5: Batch Processing & Persistence
    Engine->>Engine: Split tracks into chunks of configured batchSize
    alt Playlist is empty (0 tracks)
        Engine->>Destination: commit(jobId)
    else Has tracks
        loop For each batch chunk
            Engine->>Destination: writeTracks(jobId, batchChunk)
            Destination-->>Engine: WriteTracksResult (writtenCount)
            Engine->>Progress: Update writtenTracks, currentBatch, status
        end
        alt All batches successful
            Engine->>Destination: commit(jobId)
        else Batch write failure
            Engine->>Destination: rollback(jobId, cause)
            Engine-->>Client: Fail job & Return / Throw DestinationError
        end
    end
    end

    rect rgb(20, 50, 30)
    note right of Engine: Stage 6 & 7: Progress Update & Finalization
    Engine->>Engine: Mark job completed (completedAt timestamp)
    Engine->>Progress: Emit final completed progress
    Engine-->>Client: ImportResult (success: true, job, progress)
    end
    deactivate Engine
```

---

### Figure 3: Spotify Infrastructure, OAuth & Lazy Token Refresh

The Spotify adapter layer manages authentication, CSRF tokens, Bearer token injection, and automatic expiration refresh without leaking credentials:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant App as Application / Server
    participant OAuth as SpotifyOAuthService
    participant TokenMgr as SpotifyTokenManager
    participant HTTP as SpotifyHttpClient
    participant Accounts as Spotify Accounts (/api/token)
    participant WebAPI as Spotify Web API (/v1/...)

    rect rgb(35, 25, 45)
    note over User, Accounts: OAuth Authorization Code Flow
    App->>OAuth: createAuthorizationUrl({ state: crypto.randomUUID() })
    OAuth-->>User: Redirect to Spotify Login (with encoded scopes & state)
    User->>Accounts: User approves permissions
    Accounts-->>App: Redirect back with code & state
    App->>OAuth: verifyState(expectedState, receivedState)
    App->>OAuth: exchangeCodeForToken(code)
    OAuth->>Accounts: POST /api/token (Basic Auth, grant: authorization_code)
    Accounts-->>OAuth: 200 OK (access_token, refresh_token, expires_in)
    OAuth-->>App: SpotifyToken model
    end

    rect rgb(20, 35, 55)
    note over TokenMgr, WebAPI: Authenticated API Requests & Lazy Refresh
    App->>TokenMgr: Initialize with SpotifyToken
    App->>HTTP: client.get('/v1/playlists/{id}')
    HTTP->>TokenMgr: getValidAccessToken()
    
    alt Token valid & outside 60s safety window
        TokenMgr-->>HTTP: Return current cached access_token
    else Token expired or inside 60s safety window
        TokenMgr->>OAuth: refreshAccessToken(refreshToken)
        OAuth->>Accounts: POST /api/token (grant: refresh_token)
        Accounts-->>OAuth: New access_token
        OAuth-->>TokenMgr: Refreshed SpotifyToken
        TokenMgr-->>HTTP: Return freshly minted access_token
    end

    HTTP->>WebAPI: GET /v1/playlists/{id} [Authorization: Bearer <token>]
    
    alt 200 OK
        WebAPI-->>HTTP: JSON payload
        HTTP-->>App: Parsed response
    else 429 Rate Limit
        WebAPI-->>HTTP: 429 Too Many Requests (Retry-After header)
        HTTP-->>App: Throw SpotifyApiError (retryable: true, retryAfterSeconds)
    else 401 / 403 Error
        WebAPI-->>HTTP: 401 / 403 Forbidden
        HTTP-->>App: Throw SpotifyApiError (retryable: false, secrets scrubbed)
    end
    end
```

---

### Figure 4: Data Normalization Schema Mapping

Spotify API responses are normalized into standard, portable `ImportedTrack` domain entities. Optional or missing fields are handled safely:

```
[ Raw Spotify Track Payload ]                 [ Canonical ImportedTrack Domain Model ]
┌───────────────────────────────────────┐     ┌──────────────────────────────────────────────┐
│ id: "11dFghVXANMlKmJXsNCbNl"          │ ──▶ │ source: "spotify"                            │
│ name: "Stay"                          │ ──▶ │ sourceId: "11dFghVXANMlKmJXsNCbNl"           │
│ duration_ms: 141806                   │ ──▶ │ title: "Stay"                                │
│ explicit: true                        │ ──▶ │ artists: [                                   │
│ track_number: 1                       │ │   │   { name: "The Kid LAROI", sourceId: "..." } │
│ disc_number: 1                        │ │   │   { name: "Justin Bieber", sourceId: "..." } │
│ external_ids: { isrc: "USSM12104193" }│ │   │ ]                                            │
│ popularity: 88                        │ │   │ album: {                                     │
│ uri: "spotify:track:..."              │ │   │   title: "F*CK LOVE 3+: OVER YOU",           │
│ artists: [                            │ │   │   sourceId: "4Gfnly5CzMJQqkUWFOHaP3",        │
│   { id: "2tIP...", name: "The Kid.." }│ │   │   releaseDate: "2021-07-23",                 │
│   { id: "1uNF...", name: "Justin.." } │ │   │   totalTracks: 35,                           │
│ ]                                     │ │   │   artwork: "https://i.scdn.co/stay-art.jpg"  │
│ album: {                              │ │   │ }                                            │
│   name: "F*CK LOVE 3+: OVER YOU",     │ │   │ albumArtist: "The Kid LAROI"                 │
│   images: [{ url: "https://..." }]    │ │   │ durationMs: 141806                           │
│ }                                     │ │   │ isrc: "USSM12104193"                         │
│ (null items / deleted tracks)         │ │   │ trackNumber: 1                               │
│  └── Automatically filtered out       │ │   │ discNumber: 1                                │
└───────────────────────────────────────┘     │ explicit: true                               │
                                              │ artwork: "https://i.scdn.co/stay-art.jpg"    │
                                              │ metadata: { uri, popularity, isPlayable }    │
                                              └──────────────────────────────────────────────┘
```

---

### Figure 5: Transactional Safety & Batching Mechanics

```mermaid
flowchart LR
    A["Raw Tracks Stream"] --> B["Safety Filter<br/>Max 10,000 Tracks"]
    B --> C["Track Normalizer<br/>Schema Validation"]
    C --> D["Batch Chunker<br/>Batch Size = 100"]

    D --> E["Batch #1<br/>(100 Tracks)"]
    D --> F["Batch #2<br/>(100 Tracks)"]
    D --> G["Batch #N<br/>(Remaining)"]

    E --> H["Destination.writeTracks()"]
    F --> H
    G --> H

    H -->|All Batches OK| I["Destination.commit()<br/>Transaction Committed"]
    H -->|Any Error| J["Destination.rollback()<br/>Atomic Rollback Triggered"]

    style B fill:#b91c1c,color:#fff,stroke:#ef4444
    style I fill:#047857,color:#fff,stroke:#10b981
    style J fill:#7f1d1d,color:#fff,stroke:#f87171
```

---

## 📁 Directory Structure

```
src/
├── core/
│   ├── domain/                         # Pure domain entities, Zod schemas, constants, errors
│   │   ├── constants.ts                # MAX_IMPORT_TRACKS (10,000) & DEFAULT_BATCH_SIZE (100)
│   │   ├── errors.ts                   # Structured, machine-readable ImportError hierarchy
│   │   ├── models.ts                   # ImportedTrack, ImportedAlbum, ImportedArtist, etc.
│   │   └── index.ts
│   ├── ports/                          # Generic port interfaces
│   │   ├── music-source.ts             # MusicSource interface (getPlaylist, getTracks)
│   │   ├── music-destination.ts        # MusicDestination interface (writeTracks, commit, rollback)
│   │   ├── track-normalizer.ts         # TrackNormalizer interface
│   │   └── index.ts
│   └── services/                       # Core orchestration services
│       ├── default-track-normalizer.ts # Zod-based normalization service
│       ├── import-engine.ts            # ImportEngine 7-stage lifecycle service
│       └── index.ts
├── infrastructure/                     # Outer adapter implementations
│   ├── memory/                         # In-memory reference adapters
│   │   ├── in-memory-music-source.ts
│   │   └── in-memory-music-destination.ts
│   ├── spotify/                        # Spotify Infrastructure Adapter (Phase 2)
│   │   ├── auth/                       # Spotify OAuth & Token management
│   │   │   ├── spotify-config.ts       # Typed config & env validation
│   │   │   ├── spotify-token.ts        # Token model & safety window expiration
│   │   │   └── spotify-oauth.ts        # Authorization code flow & CSRF state verification
│   │   ├── client/                     # Authenticated HTTP client
│   │   │   ├── spotify-errors.ts       # Typed API errors with scrubbed secrets
│   │   │   ├── spotify-token-manager.ts# Lazy expiration token provider
│   │   │   └── spotify-http-client.ts  # Native fetch client with Bearer auth & retry hints
│   │   ├── models/                     # Internal Spotify API response schemas
│   │   ├── spotify-music-source.ts     # Adapter implementing MusicSource port
│   │   └── index.ts
│   └── index.ts
└── index.ts                            # Stable public API gateway

tests/
├── core/                               # Core domain & service unit tests
│   ├── import-engine.test.ts           # Full 7-stage engine lifecycle tests
│   ├── domain-validation.test.ts       # Domain entity & boundary validation
│   └── in-memory-adapters.test.ts      # In-memory adapter test suite
└── infrastructure/                     # Infrastructure adapter unit tests
    └── spotify/
        ├── spotify-config.test.ts      # Config parser & env validation
        ├── spotify-oauth.test.ts       # OAuth, CSRF state & token expiration
        ├── spotify-http-client.test.ts # Bearer auth, 401/403/429/5xx, auto-refresh
        └── spotify-music-source.test.ts# Normalization & engine integration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js LTS** (v20+ or v24+)
- **npm** (v10+)

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

### Production Build

```bash
npm run build
```

---

## 🎧 Spotify Setup Guide (Phase 2)

The Spotify integration provides an authenticated source adapter satisfying the generic `MusicSource` port.

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
Open `.env` and fill in your credentials:

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
When Spotify redirects to your callback URL with `code` and `state`:

```typescript
// Verify that the returned state matches the stored state
oauthService.verifyState(expectedState, receivedState);
```

### 7. Exchange Authorization Code for Tokens
Exchange the one-time code for a token pair (`accessToken` and `refreshToken`):

```typescript
import {
  SpotifyTokenManager,
  SpotifyHttpClient,
  SpotifyMusicSource,
  ImportEngine,
  InMemoryMusicDestination,
} from 'universal-music-import-engine';

const token = await oauthService.exchangeCodeForToken(code);

// Pass token to SpotifyTokenManager and SpotifyHttpClient
const tokenManager = new SpotifyTokenManager({
  initialToken: token,
  oauthService,
});

const client = new SpotifyHttpClient({ tokenProvider: tokenManager });
const spotifySource = new SpotifyMusicSource(client);

// Plug directly into the Universal ImportEngine
const engine = new ImportEngine({
  source: spotifySource,
  destination: new InMemoryMusicDestination(),
});

const result = await engine.importPlaylist({ playlistId: '37i9dQZF1DXcBWIGoYBM5M' });
console.log('Import success:', result.success, 'Tracks:', result.progress.writtenTracks);
```

---

## 🛡️ Security & Zero-Leakage Policy

- **No Secrets in Logs or Exceptions**: Access tokens and client secrets are never printed in logs or included in `SpotifyApiError` or `SpotifyAuthError` messages.
- **CSRF Protection**: All OAuth authorization requests mandate a caller-verified `state` token.
- **Deterministic Test Suite**: All 76 unit tests run against deterministic mock handlers—no live network requests are executed during tests.
- **Strict Git Boundaries**: Real `.env` files are ignored by git; only `.env.example` with harmless placeholders is committed.

---

## 🔄 Phase 4: Resilient, Resumable & Idempotent Import Pipeline

Phase 4 elevates the Universal Music Import Engine into an enterprise-grade, failure-resilient pipeline capable of withstanding unexpected process crashes, application restarts, network timeouts, and user cancellations.

### 1. Checkpoint Concept (`ImportCheckpoint` & `CheckpointStore`)

Imports are saved at **safe batch boundaries** via the decoupled `CheckpointStore` port:

```typescript
export interface ImportCheckpoint {
  readonly importId: string;
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly processedTracks: number;
  readonly writtenTracks: number;
  readonly skippedTracks: number;
  readonly failedTracks: number;
  readonly currentBatch: number;
  readonly currentPage: number;
  readonly lastProcessedSourceId?: string;
  readonly isTruncated: boolean;
  readonly status: ImportJobStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

- **Generic Port**: `CheckpointStore` defines `save(checkpoint)`, `load(importId)`, and `delete(importId)`. The core domain has zero dependency on specific storage engines.
- **Reference Implementation**: `InMemoryCheckpointStore` provides an in-memory implementation for tests, offline simulation, and decoupled embedding.

### 2. Resumable Import Engine

When an import fails or is interrupted:
1. Batches committed prior to the failure boundary remain fully persisted in the destination.
2. The checkpoint records the exact count of committed tracks.
3. Upon restarting with the same `jobId`, the pipeline skips already committed tracks, pulls remaining tracks from the source, and continues without duplicate writes.
4. Preserves original playlist ordering, respects `MAX_IMPORT_TRACKS` (10,000), and maintains truncation flags (`isTruncated`).
5. Completed imports return immediately without re-fetching or re-writing unless `forceRestart: true` is explicitly passed.

```
batch 1 → commit → checkpoint
batch 2 → commit → checkpoint
...
batch N → [failure or crash]
-----------------------------------------
Resume: skips batches 1..N-1 → writes batch N → completes
```

### 3. Deterministic Batch Identity & Idempotency

- **Idempotency vs Deduplication**:
  - `deduplicate: false` (default): Playlist duplicate occurrences (e.g., song A, song B, song A) remain preserved in exact order.
  - `deduplicate: true`: Duplicates within the playlist are suppressed by source identifier.
  - **Batch Idempotency**: If the same batch or job is accidentally retried, the destination identifies the batch via `WriteBatchContext` (`batchId: "${jobId}:batch:${index}"`) and prevents duplicate commits.
- **Job Isolation**: Multiple import jobs importing identical playlists run independently with dedicated batch spaces.

### 4. Cancellation via `AbortSignal`

The import engine accepts a standard `AbortSignal`:
- Propagates seamlessly from `AbortController` → `ImportEngine` → `MusicSource` & `MusicDestination`.
- Stops processing immediately without executing unnecessary downstream requests.
- Committed batches remain valid; uncommitted in-flight batches are rolled back.
- Checkpoint is preserved in `cancelled` status and can be resumed later.

### 5. Import Lifecycle & Deterministic States

| State | Description |
|---|---|
| `pending` | Initial registered state before pipeline execution begins |
| `running` | Active streaming/fetching, normalizing, writing, and checkpointing |
| `completed` | All tracks committed and finalized successfully |
| `failed` | Source, destination, normalizer, or runtime error halted the job |
| `cancelled` | AbortSignal triggered by caller; safe committed state preserved |

---

## 🌐 Phase 5: Universal Output & Data-Exchange Layer

Phase 5 builds a clean, universal output and data-exchange layer so the importer can be consumed by external music projects without coupling the engine to Android, Room, PostgreSQL, SQLite, Redis, Firebase, or any specific application.

```
Spotify (or other source)
         ↓
    Import Engine
         ↓
Universal ImportedTrack
         ↓
  Destination Adapters
   ├── JSON Exporter (streaming, schema v1)
   ├── CSV Exporter (RFC 4180 compliant)
   ├── Application Adapters (Memory, Custom)
   └── Future Database / Room SQLite Adapters
```

### 1. Universal Output Contracts (`ExportResult`)

Every destination adapter implements the extended `MusicDestination` port:
- `initialize(metadata: ImportMetadata)`: Receives source playlist and job metadata prior to track processing.
- `writeTracks(jobId, tracks, signal, context)`: Writes batches incrementally with deterministic batch identity.
- `commit(jobId)`: Commits batch state to destination.
- `rollback(jobId, error)`: Cleans uncommitted batch state on failure or cancellation.
- `complete(jobId, summary)`: Finalizes export and returns structured `ExportResult`.
- `getExportResult(jobId)`: Retrieves canonical execution summary.

```typescript
export interface ExportResult {
  readonly format: string;             // 'json' | 'csv' | 'memory' | ...
  readonly importId: string;
  readonly destinationName: string;
  readonly trackCount: number;
  readonly writtenCount: number;
  readonly skippedCount: number;
  readonly failedCount: number;
  readonly isTruncated: boolean;
  readonly schemaVersion: number;       // Canonical schema version (default: 1)
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly metadata?: Record<string, unknown>;
}
```

### 2. JSON Exporter (`JsonMusicDestination`)

- **Deterministic output**: Fields and arrays are formatted in stable, predictable order.
- **Streaming & bounded memory**: Supports incremental chunk emission via `writeChunk` callback, allowing 10,000+ tracks to be exported without holding all tracks in memory.
- **Credential sanitation**: Automatically removes any access tokens, client secrets, or auth headers from metadata.
- **Schema version**: Root `schemaVersion: 1`.

#### Canonical JSON Structure

```json
{
  "schemaVersion": 1,
  "source": "spotify",
  "importId": "job-1234-uuid",
  "playlist": {
    "id": "37i9dQZF1DXcBWIGoYBM5M",
    "name": "Today's Top Hits",
    "description": "Jung Kook is on top of the Hottest 50!",
    "owner": "Spotify",
    "totalTracks": 50
  },
  "tracks": [
    {
      "source": "spotify",
      "sourceId": "4cOdK2wGLETKBW3PvgPWqT",
      "title": "Never Gonna Give You Up",
      "artists": [
        { "name": "Rick Astley", "sourceId": "0gxyHStUvyUtUt929Ag28q" }
      ],
      "album": {
        "title": "Whenever You Need Somebody",
        "sourceId": "4Uv86qFgQIFAJrBR2v9I8z",
        "releaseDate": "1987-11-12"
      },
      "durationMs": 213573,
      "isrc": "GBARL9300134",
      "trackNumber": 1,
      "discNumber": 1,
      "explicit": false
    }
  ],
  "progress": {
    "processedTracks": 50,
    "writtenTracks": 50,
    "skippedTracks": 0,
    "failedTracks": 0,
    "isTruncated": false
  },
  "createdAt": "2026-10-08T10:00:00.000Z",
  "completedAt": "2026-10-08T10:01:00.000Z"
}
```

### 3. CSV Exporter (`CsvMusicDestination`)

Compliant with **RFC 4180**:
- **Standard Columns**:
  `source,sourceId,title,artists,album,albumArtist,durationMs,isrc,trackNumber,discNumber,explicit,artwork`
- **Escaping rules**: Commas, double quotes, and newlines inside fields are enclosed in double quotes with doubled internal quotes (`""`).
- **Multilingual & Unicode**: Fully handles UTF-8 Unicode, accents, Japanese/Korean/Arabic, and emojis.
- **Deterministic Array Representation**: Artist arrays formatted with deterministic semicolon delimiter (`Artist 1; Artist 2`).
- **Streaming**: Supports chunk-based batch streaming with `writeChunk`.

### 4. Versioned Import Manifest (`ImportManifest`)

The manifest represents **"What happened during this import?"**, complementing the checkpoint which answers **"Where can the import safely resume?"**.

- **Lifecycle States**: `pending`, `running`, `completed`, `failed`, `cancelled`.
- **Isolation & Immutability**: Captured manifests cannot be mutated once finalized.
- **Zero Secrets**: Strictly sanitized; no OAuth tokens or client secrets are persisted.
- **Store Abstraction**: Managed through `ImportManifestStore` port (`save`, `load`, `list`, `delete`), with reference `InMemoryImportManifestStore`.

```typescript
export interface ImportManifest {
  readonly schemaVersion: number;      // Canonical schema version: 1
  readonly importerVersion: string;    // '0.1.0'
  readonly importId: string;
  readonly source: {
    readonly name: string;
    readonly playlistId: string;
    readonly title?: string;
    readonly owner?: string;
    readonly totalTracks?: number;
  };
  readonly destination: {
    readonly name: string;
    readonly format?: string;
  };
  readonly lifecycle: {
    readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly completedAt?: string;
  };
  readonly stats: {
    readonly processedTracks: number;
    readonly writtenTracks: number;
    readonly skippedTracks: number;
    readonly failedTracks: number;
    readonly isTruncated: boolean;
    readonly batchCount: number;
  };
  readonly error?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}
```

### 5. Resumed Import Equivalence Guarantee

The engine guarantees that an import completed after one or more resume cycles produces output equivalent to a clean, single-pass run:
- Playlist ordering is strictly preserved across resumption boundaries.
- Duplicate occurrences in the source playlist are retained in original sequence.
- Export result stats (`trackCount`, `writtenCount`, `isTruncated`) match identical clean import values.

---


## 🛡️ Security & Zero-Leakage Policy

- **No Secrets in Logs or Exceptions**: Access tokens, client secrets, and sensitive credentials are never output to logs or error objects.
- **CSRF Protection**: All OAuth authorization requests mandate a caller-verified `state` token.
- **Deterministic Test Suite**: All tests run against deterministic mock handlers—zero live Spotify credentials or external network dependencies.
- **Strict Git Boundaries**: Real `.env` files are ignored by git; only `.env.example` with harmless placeholders is committed.

---

## 🚧 Phase Boundaries & What is Deferred

- ✅ **Phase 1 Completed**: Universal Music Import Engine domain entities, hexagonal ports, `ImportEngine` lifecycle, batching, and in-memory test harnesses.
- ✅ **Phase 2 Completed**: Isolated Spotify authentication layer, OAuth flow, automated token lifecycle manager, and `SpotifyAuthenticatedSource`.
- ✅ **Phase 4 Completed**: Resilient, Resumable & Idempotent Import Pipeline (`ImportCheckpoint`, `CheckpointStore`, batch boundaries, `WriteBatchContext`, AbortSignal cancellation, failure recovery, 16 integration scenarios).
- ✅ **Phase 5 Completed**: Universal Output & Data-Exchange Layer (`ExportResult`, `JsonMusicDestination`, `CsvMusicDestination`, `ImportManifest`, `ImportManifestStore`, RFC 4180 CSV compliance, bounded streaming memory, 15 integration scenarios).
- ❌ **Phase 6 (Deferred)**: Asynchronous background job queues (Redis, BullMQ, distributed workers).
- ❌ **Phase 7 (Deferred)**: Transport layers (CLI commands, REST API endpoints, Webhooks).
- ❌ **Out of Scope**: Audio stream scraping, YouTube / Apple Music integration, DRM tampering.


---

## 📜 License

This project is open-source software licensed under the **GNU General Public License Version 3.0 (GPL-3.0)** - see the [LICENSE](LICENSE) file for the full text of the license terms and conditions.

Under the GNU GPL v3.0, you are free to inspect, run, share, and modify the code, provided that any derivative works also remain open-source and free under the same license terms.
