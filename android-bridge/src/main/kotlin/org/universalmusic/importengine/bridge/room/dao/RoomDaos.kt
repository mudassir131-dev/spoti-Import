package org.universalmusic.importengine.bridge.room.dao

import androidx.room.*
import org.universalmusic.importengine.bridge.room.entities.*

/**
 * Track DAO interface
 */
@Dao
interface TrackDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(track: RoomTrackEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertAll(tracks: List<RoomTrackEntity>): List<Long>

    @Query("SELECT * FROM tracks WHERE source_id = :sourceId AND source = :source LIMIT 1")
    fun findBySourceId(sourceId: String, source: String): RoomTrackEntity?

    @Query("SELECT * FROM tracks WHERE id = :id LIMIT 1")
    fun findById(id: Long): RoomTrackEntity?

    @Query("SELECT * FROM tracks ORDER BY id ASC")
    fun getAll(): List<RoomTrackEntity>

    @Query("SELECT COUNT(*) FROM tracks")
    fun count(): Long
}

/**
 * Playlist DAO interface
 */
@Dao
interface PlaylistDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(playlist: RoomPlaylistEntity): Long

    @Query("SELECT * FROM playlists WHERE source_id = :sourceId AND source = :source LIMIT 1")
    fun findBySourceId(sourceId: String, source: String): RoomPlaylistEntity?

    @Query("SELECT * FROM playlists WHERE id = :id LIMIT 1")
    fun findById(id: Long): RoomPlaylistEntity?

    @Query("SELECT * FROM playlists ORDER BY id ASC")
    fun getAll(): List<RoomPlaylistEntity>
}

/**
 * Playlist Occurrence DAO interface
 */
@Dao
interface OccurrenceDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(occurrence: RoomPlaylistOccurrenceEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertAll(occurrences: List<RoomPlaylistOccurrenceEntity>): List<Long>

    @Query("SELECT * FROM playlist_occurrences WHERE playlist_id = :playlistId ORDER BY position ASC")
    fun getByPlaylistOrdered(playlistId: Long): List<RoomPlaylistOccurrenceEntity>

    @Query("SELECT * FROM playlist_occurrences WHERE import_job_id = :jobId ORDER BY position ASC")
    fun getByJobOrdered(jobId: String): List<RoomPlaylistOccurrenceEntity>

    @Query("SELECT COUNT(*) FROM playlist_occurrences WHERE playlist_id = :playlistId")
    fun countByPlaylist(playlistId: Long): Long

    @Query("SELECT MAX(position) FROM playlist_occurrences WHERE import_job_id = :jobId")
    fun getMaxPositionForJob(jobId: String): Int?
}

/**
 * Import Job DAO interface
 */
@Dao
interface ImportJobDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(job: RoomImportJobEntity): Long

    @Update
    fun update(job: RoomImportJobEntity)

    @Query("SELECT * FROM import_jobs WHERE job_id = :jobId LIMIT 1")
    fun findByJobId(jobId: String): RoomImportJobEntity?

    @Query("UPDATE import_jobs SET status = :status, written_tracks = :writtenTracks, last_committed_position = :lastPosition WHERE job_id = :jobId")
    fun updateProgress(jobId: String, status: String, writtenTracks: Int, lastPosition: Int)

    @Query("UPDATE import_jobs SET status = :status, completed_at = :completedAt WHERE job_id = :jobId")
    fun markCompleted(jobId: String, status: String, completedAt: Long)
}
