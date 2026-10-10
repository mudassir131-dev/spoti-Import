package org.universalmusic.importengine.bridge.room.adapter

import org.universalmusic.importengine.bridge.room.dao.ImportJobDao
import org.universalmusic.importengine.bridge.room.dao.OccurrenceDao
import org.universalmusic.importengine.bridge.room.dao.PlaylistDao
import org.universalmusic.importengine.bridge.room.dao.TrackDao
import org.universalmusic.importengine.bridge.room.entities.RoomImportJobEntity
import org.universalmusic.importengine.bridge.room.entities.RoomPlaylistEntity
import org.universalmusic.importengine.bridge.room.entities.RoomPlaylistOccurrenceEntity
import org.universalmusic.importengine.bridge.room.entities.RoomTrackEntity
import java.sql.Connection
import java.sql.DriverManager
import java.sql.Statement

/**
 * Universal Room Database Adapter.
 * Provides a portable SQLite-backed Room implementation with full transaction support,
 * DAOs, and schema migrations.
 */
class UniversalRoomDatabaseAdapter(
    val dbUrl: String = "jdbc:sqlite::memory:"
) : AutoCloseable {

    private val connection: Connection = DriverManager.getConnection(dbUrl).apply {
        autoCommit = true
    }

    var schemaVersion: Int = 1
        private set

    init {
        createTablesV1()
    }

    private fun createTablesV1() {
        connection.createStatement().use { stmt ->
            stmt.execute(
                """
                CREATE TABLE IF NOT EXISTS tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artists_json TEXT NOT NULL,
                    album_title TEXT,
                    album_source_id TEXT,
                    album_release_date TEXT,
                    album_artwork TEXT,
                    album_artist TEXT,
                    duration_ms INTEGER,
                    isrc TEXT,
                    track_number INTEGER,
                    disc_number INTEGER,
                    explicit INTEGER,
                    artwork TEXT,
                    metadata_json TEXT,
                    created_at INTEGER NOT NULL
                );
                """.trimIndent()
            )
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_tracks_source_id ON tracks(source_id);")

            stmt.execute(
                """
                CREATE TABLE IF NOT EXISTS playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    owner TEXT,
                    total_tracks INTEGER,
                    artwork TEXT,
                    metadata_json TEXT,
                    created_at INTEGER NOT NULL
                );
                """.trimIndent()
            )
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_playlists_source_id ON playlists(source_id);")

            stmt.execute(
                """
                CREATE TABLE IF NOT EXISTS playlist_occurrences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    playlist_id INTEGER NOT NULL,
                    track_id INTEGER NOT NULL,
                    occurrence_id TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    source_id TEXT NOT NULL,
                    added_at TEXT,
                    import_job_id TEXT NOT NULL
                );
                """.trimIndent()
            )
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_occ_playlist_id ON playlist_occurrences(playlist_id);")
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_occ_track_id ON playlist_occurrences(track_id);")
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_occ_job_id ON playlist_occurrences(import_job_id);")
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_occ_pos ON playlist_occurrences(position);")

            stmt.execute(
                """
                CREATE TABLE IF NOT EXISTS import_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL UNIQUE,
                    source TEXT NOT NULL,
                    status TEXT NOT NULL,
                    is_truncated INTEGER NOT NULL,
                    processed_tracks INTEGER NOT NULL,
                    written_tracks INTEGER NOT NULL,
                    last_committed_position INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    completed_at INTEGER
                );
                """.trimIndent()
            )
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON import_jobs(job_id);")
        }
    }

    /**
     * Executes non-destructive schema migration from Version 1 to Version 2.
     * Adds 'sync_status' and 'rating' columns to tracks.
     */
    fun migrateV1ToV2() {
        if (schemaVersion >= 2) return
        connection.createStatement().use { stmt ->
            stmt.execute("ALTER TABLE tracks ADD COLUMN sync_status TEXT DEFAULT 'synced';")
            stmt.execute("ALTER TABLE tracks ADD COLUMN user_rating INTEGER DEFAULT 0;")
        }
        schemaVersion = 2
    }

    /**
     * Runs a block within a database transaction.
     */
    fun <T> runInTransaction(block: () -> T): T {
        val wasAutoCommit = connection.autoCommit
        connection.autoCommit = false
        return try {
            val result = block()
            connection.commit()
            result
        } catch (e: Throwable) {
            connection.rollback()
            throw e
        } finally {
            connection.autoCommit = wasAutoCommit
        }
    }

    val trackDao: TrackDao = object : TrackDao {
        override fun insert(track: RoomTrackEntity): Long {
            val sql = """
                INSERT INTO tracks (source_id, source, title, artists_json, album_title, album_source_id,
                    album_release_date, album_artwork, album_artist, duration_ms, isrc, track_number,
                    disc_number, explicit, artwork, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
            connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS).use { ps ->
                ps.setString(1, track.sourceId)
                ps.setString(2, track.source)
                ps.setString(3, track.title)
                ps.setString(4, track.artistsJson)
                ps.setString(5, track.albumTitle)
                ps.setString(6, track.albumSourceId)
                ps.setString(7, track.albumReleaseDate)
                ps.setString(8, track.albumArtwork)
                ps.setString(9, track.albumArtist)
                if (track.durationMs != null) ps.setLong(10, track.durationMs) else ps.setNull(10, java.sql.Types.INTEGER)
                ps.setString(11, track.isrc)
                if (track.trackNumber != null) ps.setInt(12, track.trackNumber) else ps.setNull(12, java.sql.Types.INTEGER)
                if (track.discNumber != null) ps.setInt(13, track.discNumber) else ps.setNull(13, java.sql.Types.INTEGER)
                if (track.explicit != null) ps.setInt(14, if (track.explicit) 1 else 0) else ps.setNull(14, java.sql.Types.INTEGER)
                ps.setString(15, track.artwork)
                ps.setString(16, track.metadataJson)
                ps.setLong(17, track.createdAt)
                ps.executeUpdate()
                val rs = ps.generatedKeys
                return if (rs.next()) rs.getLong(1) else -1L
            }
        }

        override fun insertAll(tracks: List<RoomTrackEntity>): List<Long> {
            return tracks.map { insert(it) }
        }

        override fun findBySourceId(sourceId: String, source: String): RoomTrackEntity? {
            val sql = "SELECT * FROM tracks WHERE source_id = ? AND source = ? LIMIT 1"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, sourceId)
                ps.setString(2, source)
                val rs = ps.executeQuery()
                if (rs.next()) {
                    return mapRowToTrack(rs)
                }
            }
            return null
        }

        override fun findById(id: Long): RoomTrackEntity? {
            val sql = "SELECT * FROM tracks WHERE id = ? LIMIT 1"
            connection.prepareStatement(sql).use { ps ->
                ps.setLong(1, id)
                val rs = ps.executeQuery()
                if (rs.next()) {
                    return mapRowToTrack(rs)
                }
            }
            return null
        }

        override fun getAll(): List<RoomTrackEntity> {
            val list = mutableListOf<RoomTrackEntity>()
            connection.createStatement().use { stmt ->
                val rs = stmt.executeQuery("SELECT * FROM tracks ORDER BY id ASC")
                while (rs.next()) {
                    list.add(mapRowToTrack(rs))
                }
            }
            return list
        }

        override fun count(): Long {
            connection.createStatement().use { stmt ->
                val rs = stmt.executeQuery("SELECT COUNT(*) FROM tracks")
                return if (rs.next()) rs.getLong(1) else 0L
            }
        }

        private fun mapRowToTrack(rs: java.sql.ResultSet): RoomTrackEntity {
            return RoomTrackEntity(
                id = rs.getLong("id"),
                sourceId = rs.getString("source_id"),
                source = rs.getString("source"),
                title = rs.getString("title"),
                artistsJson = rs.getString("artists_json"),
                albumTitle = rs.getString("album_title"),
                albumSourceId = rs.getString("album_source_id"),
                albumReleaseDate = rs.getString("album_release_date"),
                albumArtwork = rs.getString("album_artwork"),
                albumArtist = rs.getString("album_artist"),
                durationMs = rs.getObject("duration_ms")?.let { (it as Number).toLong() },
                isrc = rs.getString("isrc"),
                trackNumber = rs.getObject("track_number")?.let { (it as Number).toInt() },
                discNumber = rs.getObject("disc_number")?.let { (it as Number).toInt() },
                explicit = rs.getObject("explicit")?.let { (it as Number).toInt() == 1 },
                artwork = rs.getString("artwork"),
                metadataJson = rs.getString("metadata_json"),
                createdAt = rs.getLong("created_at")
            )
        }
    }

    val playlistDao: PlaylistDao = object : PlaylistDao {
        override fun insert(playlist: RoomPlaylistEntity): Long {
            val sql = """
                INSERT INTO playlists (source_id, source, name, description, owner, total_tracks, artwork, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
            connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS).use { ps ->
                ps.setString(1, playlist.sourceId)
                ps.setString(2, playlist.source)
                ps.setString(3, playlist.name)
                ps.setString(4, playlist.description)
                ps.setString(5, playlist.owner)
                if (playlist.totalTracks != null) ps.setInt(6, playlist.totalTracks) else ps.setNull(6, java.sql.Types.INTEGER)
                ps.setString(7, playlist.artwork)
                ps.setString(8, playlist.metadataJson)
                ps.setLong(9, playlist.createdAt)
                ps.executeUpdate()
                val rs = ps.generatedKeys
                return if (rs.next()) rs.getLong(1) else -1L
            }
        }

        override fun findBySourceId(sourceId: String, source: String): RoomPlaylistEntity? {
            val sql = "SELECT * FROM playlists WHERE source_id = ? AND source = ? LIMIT 1"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, sourceId)
                ps.setString(2, source)
                val rs = ps.executeQuery()
                if (rs.next()) {
                    return mapRowToPlaylist(rs)
                }
            }
            return null
        }

        override fun findById(id: Long): RoomPlaylistEntity? {
            val sql = "SELECT * FROM playlists WHERE id = ? LIMIT 1"
            connection.prepareStatement(sql).use { ps ->
                ps.setLong(1, id)
                val rs = ps.executeQuery()
                if (rs.next()) {
                    return mapRowToPlaylist(rs)
                }
            }
            return null
        }

        override fun getAll(): List<RoomPlaylistEntity> {
            val list = mutableListOf<RoomPlaylistEntity>()
            connection.createStatement().use { stmt ->
                val rs = stmt.executeQuery("SELECT * FROM playlists ORDER BY id ASC")
                while (rs.next()) {
                    list.add(mapRowToPlaylist(rs))
                }
            }
            return list
        }

        private fun mapRowToPlaylist(rs: java.sql.ResultSet): RoomPlaylistEntity {
            return RoomPlaylistEntity(
                id = rs.getLong("id"),
                sourceId = rs.getString("source_id"),
                source = rs.getString("source"),
                name = rs.getString("name"),
                description = rs.getString("description"),
                owner = rs.getString("owner"),
                totalTracks = rs.getObject("total_tracks")?.let { (it as Number).toInt() },
                artwork = rs.getString("artwork"),
                metadataJson = rs.getString("metadata_json"),
                createdAt = rs.getLong("created_at")
            )
        }
    }

    val occurrenceDao: OccurrenceDao = object : OccurrenceDao {
        override fun insert(occurrence: RoomPlaylistOccurrenceEntity): Long {
            val sql = """
                INSERT INTO playlist_occurrences (playlist_id, track_id, occurrence_id, position, source_id, added_at, import_job_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
            connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS).use { ps ->
                ps.setLong(1, occurrence.playlistId)
                ps.setLong(2, occurrence.trackId)
                ps.setString(3, occurrence.occurrenceId)
                ps.setInt(4, occurrence.position)
                ps.setString(5, occurrence.sourceId)
                ps.setString(6, occurrence.addedAt)
                ps.setString(7, occurrence.importJobId)
                ps.executeUpdate()
                val rs = ps.generatedKeys
                return if (rs.next()) rs.getLong(1) else -1L
            }
        }

        override fun insertAll(occurrences: List<RoomPlaylistOccurrenceEntity>): List<Long> {
            return occurrences.map { insert(it) }
        }

        override fun getByPlaylistOrdered(playlistId: Long): List<RoomPlaylistOccurrenceEntity> {
            val list = mutableListOf<RoomPlaylistOccurrenceEntity>()
            val sql = "SELECT * FROM playlist_occurrences WHERE playlist_id = ? ORDER BY position ASC"
            connection.prepareStatement(sql).use { ps ->
                ps.setLong(1, playlistId)
                val rs = ps.executeQuery()
                while (rs.next()) {
                    list.add(mapRowToOccurrence(rs))
                }
            }
            return list
        }

        override fun getByJobOrdered(jobId: String): List<RoomPlaylistOccurrenceEntity> {
            val list = mutableListOf<RoomPlaylistOccurrenceEntity>()
            val sql = "SELECT * FROM playlist_occurrences WHERE import_job_id = ? ORDER BY position ASC"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, jobId)
                val rs = ps.executeQuery()
                while (rs.next()) {
                    list.add(mapRowToOccurrence(rs))
                }
            }
            return list
        }

        override fun countByPlaylist(playlistId: Long): Long {
            val sql = "SELECT COUNT(*) FROM playlist_occurrences WHERE playlist_id = ?"
            connection.prepareStatement(sql).use { ps ->
                ps.setLong(1, playlistId)
                val rs = ps.executeQuery()
                return if (rs.next()) rs.getLong(1) else 0L
            }
        }

        override fun getMaxPositionForJob(jobId: String): Int? {
            val sql = "SELECT MAX(position) FROM playlist_occurrences WHERE import_job_id = ?"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, jobId)
                val rs = ps.executeQuery()
                return if (rs.next()) rs.getObject(1)?.let { (it as Number).toInt() } else null
            }
        }

        private fun mapRowToOccurrence(rs: java.sql.ResultSet): RoomPlaylistOccurrenceEntity {
            return RoomPlaylistOccurrenceEntity(
                id = rs.getLong("id"),
                playlistId = rs.getLong("playlist_id"),
                trackId = rs.getLong("track_id"),
                occurrenceId = rs.getString("occurrence_id"),
                position = rs.getInt("position"),
                sourceId = rs.getString("source_id"),
                addedAt = rs.getString("added_at"),
                importJobId = rs.getString("import_job_id")
            )
        }
    }

    val importJobDao: ImportJobDao = object : ImportJobDao {
        override fun insert(job: RoomImportJobEntity): Long {
            val sql = """
                INSERT INTO import_jobs (job_id, source, status, is_truncated, processed_tracks, written_tracks, last_committed_position, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
            connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS).use { ps ->
                ps.setString(1, job.jobId)
                ps.setString(2, job.source)
                ps.setString(3, job.status)
                ps.setInt(4, if (job.isTruncated) 1 else 0)
                ps.setInt(5, job.processedTracks)
                ps.setInt(6, job.writtenTracks)
                ps.setInt(7, job.lastCommittedPosition)
                ps.setLong(8, job.createdAt)
                if (job.completedAt != null) ps.setLong(9, job.completedAt) else ps.setNull(9, java.sql.Types.INTEGER)
                ps.executeUpdate()
                val rs = ps.generatedKeys
                return if (rs.next()) rs.getLong(1) else -1L
            }
        }

        override fun update(job: RoomImportJobEntity) {
            val sql = """
                UPDATE import_jobs SET source = ?, status = ?, is_truncated = ?, processed_tracks = ?,
                    written_tracks = ?, last_committed_position = ?, completed_at = ?
                WHERE job_id = ?
            """.trimIndent()
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, job.source)
                ps.setString(2, job.status)
                ps.setInt(3, if (job.isTruncated) 1 else 0)
                ps.setInt(4, job.processedTracks)
                ps.setInt(5, job.writtenTracks)
                ps.setInt(6, job.lastCommittedPosition)
                if (job.completedAt != null) ps.setLong(7, job.completedAt) else ps.setNull(7, java.sql.Types.INTEGER)
                ps.setString(8, job.jobId)
                ps.executeUpdate()
            }
        }

        override fun findByJobId(jobId: String): RoomImportJobEntity? {
            val sql = "SELECT * FROM import_jobs WHERE job_id = ? LIMIT 1"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, jobId)
                val rs = ps.executeQuery()
                if (rs.next()) {
                    return RoomImportJobEntity(
                        id = rs.getLong("id"),
                        jobId = rs.getString("job_id"),
                        source = rs.getString("source"),
                        status = rs.getString("status"),
                        isTruncated = rs.getInt("is_truncated") == 1,
                        processedTracks = rs.getInt("processed_tracks"),
                        writtenTracks = rs.getInt("written_tracks"),
                        lastCommittedPosition = rs.getInt("last_committed_position"),
                        createdAt = rs.getLong("created_at"),
                        completedAt = rs.getObject("completed_at")?.let { (it as Number).toLong() }
                    )
                }
            }
            return null
        }

        override fun updateProgress(jobId: String, status: String, writtenTracks: Int, lastPosition: Int) {
            val sql = "UPDATE import_jobs SET status = ?, written_tracks = ?, last_committed_position = ? WHERE job_id = ?"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, status)
                ps.setInt(2, writtenTracks)
                ps.setInt(3, lastPosition)
                ps.setString(4, jobId)
                ps.executeUpdate()
            }
        }

        override fun markCompleted(jobId: String, status: String, completedAt: Long) {
            val sql = "UPDATE import_jobs SET status = ?, completed_at = ? WHERE job_id = ?"
            connection.prepareStatement(sql).use { ps ->
                ps.setString(1, status)
                ps.setLong(2, completedAt)
                ps.setString(3, jobId)
                ps.executeUpdate()
            }
        }
    }

    override fun close() {
        if (!connection.isClosed) {
            connection.close()
        }
    }
}
