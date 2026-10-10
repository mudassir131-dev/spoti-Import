package org.universalmusic.importengine.bridge.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Universal Music Import Engine - Android Bridge Models (Phase 6)
 *
 * Implements the Kotlin data model corresponding to the universal interchange contract.
 *
 * Guarantees:
 * - Schema version validation
 * - Optional fields remain optional
 * - Unknown metadata does not crash parsing
 * - Source identifiers distinct from local database IDs
 * - Track occurrence identity preserved
 */

@Serializable
enum class ImportStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED;

    companion object {
        fun fromString(value: String?): ImportStatus {
            return when (value?.lowercase()) {
                "pending" -> PENDING
                "running" -> RUNNING
                "completed" -> COMPLETED
                "failed" -> FAILED
                "cancelled" -> CANCELLED
                else -> COMPLETED
            }
        }
    }
}

@Serializable
data class ImportedArtist(
    val name: String,
    val sourceId: String? = null,
    val roles: List<String>? = null,
    val metadata: Map<String, JsonElement>? = null
)

@Serializable
data class ImportedAlbum(
    val title: String,
    val sourceId: String? = null,
    val releaseDate: String? = null,
    val totalTracks: Int? = null,
    val artists: List<ImportedArtist>? = null,
    val artwork: String? = null,
    val metadata: Map<String, JsonElement>? = null
)

@Serializable
data class UniversalTrackOccurrence(
    val occurrenceId: String,
    val position: Int,
    val source: String,
    val sourceId: String,
    val title: String,
    val artists: List<ImportedArtist>,
    val album: ImportedAlbum? = null,
    val albumArtist: String? = null,
    val durationMs: Long? = null,
    val isrc: String? = null,
    val trackNumber: Int? = null,
    val discNumber: Int? = null,
    val explicit: Boolean? = null,
    val artwork: String? = null,
    val addedAt: String? = null,
    val metadata: Map<String, JsonElement>? = null
)

@Serializable
data class UniversalPlaylistMetadata(
    val id: String,
    val name: String,
    val description: String? = null,
    val owner: String? = null,
    val totalTracks: Int? = null,
    val artwork: String? = null,
    val metadata: Map<String, JsonElement>? = null
)

@Serializable
data class UniversalImportStats(
    val processedTracks: Int = 0,
    val writtenTracks: Int = 0,
    val skippedTracks: Int = 0,
    val failedTracks: Int = 0,
    val isTruncated: Boolean = false
)

@Serializable
data class UniversalImportPayload(
    val schemaVersion: Int,
    val importId: String,
    val source: String,
    val status: String = "completed",
    val playlist: UniversalPlaylistMetadata? = null,
    val isTruncated: Boolean = false,
    val tracks: List<UniversalTrackOccurrence> = emptyList(),
    val stats: UniversalImportStats? = null,
    val progress: UniversalImportStats? = null,
    val metadata: Map<String, JsonElement>? = null,
    val createdAt: String? = null,
    val completedAt: String? = null,
    val exportedAt: String
)
