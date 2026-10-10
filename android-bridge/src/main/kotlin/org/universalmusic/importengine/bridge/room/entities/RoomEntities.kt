package org.universalmusic.importengine.bridge.room.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Universal Music Import Engine - Room Entities (Phase 6)
 *
 * Distinguishes:
 * - Local Database Primary Key: id (Long auto-generated)
 * - Source Track Identity: sourceId (e.g. Spotify ID)
 * - Source Identity: source
 * - Playlist Occurrence Identity: occurrenceId + position
 * - Playlist Identity: id (local) / sourceId (source)
 */

@Entity(tableName = "tracks")
data class RoomTrackEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "source_id", index = true)
    val sourceId: String,

    @ColumnInfo(name = "source")
    val source: String,

    @ColumnInfo(name = "title")
    val title: String,

    @ColumnInfo(name = "artists_json")
    val artistsJson: String,

    @ColumnInfo(name = "album_title")
    val albumTitle: String? = null,

    @ColumnInfo(name = "album_source_id")
    val albumSourceId: String? = null,

    @ColumnInfo(name = "album_release_date")
    val albumReleaseDate: String? = null,

    @ColumnInfo(name = "album_artwork")
    val albumArtwork: String? = null,

    @ColumnInfo(name = "album_artist")
    val albumArtist: String? = null,

    @ColumnInfo(name = "duration_ms")
    val durationMs: Long? = null,

    @ColumnInfo(name = "isrc")
    val isrc: String? = null,

    @ColumnInfo(name = "track_number")
    val trackNumber: Int? = null,

    @ColumnInfo(name = "disc_number")
    val discNumber: Int? = null,

    @ColumnInfo(name = "explicit")
    val explicit: Boolean? = null,

    @ColumnInfo(name = "artwork")
    val artwork: String? = null,

    @ColumnInfo(name = "metadata_json")
    val metadataJson: String? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "playlists")
data class RoomPlaylistEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "source_id", index = true)
    val sourceId: String,

    @ColumnInfo(name = "source")
    val source: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "description")
    val description: String? = null,

    @ColumnInfo(name = "owner")
    val owner: String? = null,

    @ColumnInfo(name = "total_tracks")
    val totalTracks: Int? = null,

    @ColumnInfo(name = "artwork")
    val artwork: String? = null,

    @ColumnInfo(name = "metadata_json")
    val metadataJson: String? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "playlist_occurrences")
data class RoomPlaylistOccurrenceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "playlist_id", index = true)
    val playlistId: Long,

    @ColumnInfo(name = "track_id", index = true)
    val trackId: Long,

    @ColumnInfo(name = "occurrence_id")
    val occurrenceId: String,

    @ColumnInfo(name = "position", index = true)
    val position: Int,

    @ColumnInfo(name = "source_id")
    val sourceId: String,

    @ColumnInfo(name = "added_at")
    val addedAt: String? = null,

    @ColumnInfo(name = "import_job_id", index = true)
    val importJobId: String
)

@Entity(tableName = "import_jobs")
data class RoomImportJobEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "job_id", index = true)
    val jobId: String,

    @ColumnInfo(name = "source")
    val source: String,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "is_truncated")
    val isTruncated: Boolean = false,

    @ColumnInfo(name = "processed_tracks")
    val processedTracks: Int = 0,

    @ColumnInfo(name = "written_tracks")
    val writtenTracks: Int = 0,

    @ColumnInfo(name = "last_committed_position")
    val lastCommittedPosition: Int = -1,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "completed_at")
    val completedAt: Long? = null
)
