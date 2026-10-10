# Phase 6 Universal Import Interchange Contract Specification (v1)

## 1. Executive Summary

This specification establishes the canonical JSON data interchange format connecting the TypeScript/Node.js Universal Import Engine (Phases 1–5) and the Kotlin Android Room Bridge (Phase 6).

The interchange format is designed for:
- Complete decoupling of TypeScript core from Android/JVM environments
- Deterministic schema-version validation
- Explicit distinction between track identity and playlist occurrence identity
- High-efficiency streaming and batch insertion
- Zero credential leakage

---

## 2. Interchange Contract Schema (JSON)

### Top-Level Document Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | `Integer` | Yes | Fixed integer schema version (`1` for v1 contract). |
| `importId` | `String` | Yes | Globally unique import run / job identifier. |
| `source` | `String` | Yes | Ingestion source identifier (e.g., `spotify`, `in-memory`). |
| `status` | `String` | Yes | Import lifecycle status (`pending`, `running`, `completed`, `failed`, `cancelled`). |
| `playlist` | `Object` | No | Optional playlist-level metadata. |
| `isTruncated` | `Boolean` | Yes | Indicates if ingestion hit the safety ceiling (10,000 tracks). |
| `tracks` | `Array` | Yes | Ordered array of track occurrences. |
| `stats` | `Object` | No | Ingestion counters (`processedTracks`, `writtenTracks`, `skippedTracks`, `failedTracks`). |
| `progress` | `Object` | No | Backward-compatible progress stats object. |
| `metadata` | `Object` | No | Optional unindexed domain metadata. |
| `createdAt` | `String` | No | ISO 8601 creation timestamp. |
| `completedAt` | `String` | No | ISO 8601 completion timestamp. |
| `exportedAt` | `String` | Yes | ISO 8601 export timestamp. |

---

## 3. Track Identity vs. Playlist Occurrence Identity

A playlist can contain repeated tracks (e.g., a track placed at position 0 and position 42). To model this accurately:

1. **Source Track Identity (`sourceId`)**:
   - The original identifier from the source provider (e.g., Spotify track ID).
   - Identifies the musical recording itself.

2. **Playlist Occurrence Identity (`occurrenceId`, `position`)**:
   - `occurrenceId`: Unique identifier for the track's entry in this playlist.
   - `position`: 0-based integer indicating position in sequence.
   - Preserves exact ordering and enables repeated tracks to coexist without primary key collisions.

3. **Local Database ID (`id`)**:
   - Auto-generated 64-bit integer (`Long` in Kotlin / SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`).
   - Completely decoupled from external provider IDs.

---

## 4. Track Occurrence Entity Schema

```json
{
  "occurrenceId": "occ_0",
  "position": 0,
  "source": "spotify",
  "sourceId": "4cOdK2wGLETKBW3PvgPWqT",
  "title": "Seven (feat. Latto)",
  "artists": [
    {
      "name": "Jung Kook",
      "sourceId": "6HaGTQPmzraVmaVxvz695O",
      "roles": ["primary"]
    }
  ],
  "album": {
    "title": "Seven (feat. Latto)",
    "sourceId": "53CJvPkNo3VUv14u5x0ec9",
    "releaseDate": "2023-07-14",
    "totalTracks": 2,
    "artwork": "https://example.com/artwork.jpg"
  },
  "albumArtist": "Jung Kook",
  "durationMs": 184400,
  "isrc": "USUG12304895",
  "trackNumber": 1,
  "discNumber": 1,
  "explicit": true,
  "artwork": "https://example.com/artwork.jpg",
  "addedAt": "2026-10-01T12:00:00.000Z",
  "metadata": {}
}
```

---

## 5. Security and Credential Safeguards

All destination adapters (such as `JsonMusicDestination`) sanitize metadata before serialization:
- Regex filter `/(token|secret|password|auth|key|credential)/i` strips sensitive fields.
- Access tokens and client secrets are prohibited from all JSON exports.
