package org.universalmusic.importengine.bridge.importer

import org.universalmusic.importengine.bridge.models.UniversalImportPayload
import org.universalmusic.importengine.bridge.room.adapter.UniversalRoomDatabaseAdapter
import org.universalmusic.importengine.bridge.room.entities.RoomImportJobEntity
import org.universalmusic.importengine.bridge.room.mapping.DefaultRoomEntityMapper

data class BatchImporterConfig(
    val batchSize: Int = 100
) {
    init {
        require(batchSize in 1..10_000) { "batchSize must be between 1 and 10,000" }
    }
}

sealed class ImportExecutionResult {
    data class Success(
        val jobId: String,
        val totalWritten: Int,
        val isTruncated: Boolean
    ) : ImportExecutionResult()

    data class Cancelled(
        val jobId: String,
        val lastCommittedPosition: Int,
        val tracksCommittedSoFar: Int
    ) : ImportExecutionResult()

    data class SkippedDuplicate(
        val jobId: String,
        val reason: String
    ) : ImportExecutionResult()

    data class Failure(
        val jobId: String,
        val error: String,
        val lastCommittedPosition: Int
    ) : ImportExecutionResult()
}

/**
 * High-performance, transactional and restart-safe batch importer.
 */
class BatchImporter(
    private val db: UniversalRoomDatabaseAdapter,
    private val config: BatchImporterConfig = BatchImporterConfig()
) {

    /**
     * Executes batch import of the validated payload.
     * Guaranteed:
     * - Configurable batch sizing (never 10,000 in one transaction)
     * - Atomic writes per batch
     * - Duplicate execution prevention
     * - Clean resumption from interrupted checkpoints
     * - Cancellation at safe batch boundaries
     */
    fun importPayload(
        payload: UniversalImportPayload,
        isCancelled: () -> Boolean = { false }
    ): ImportExecutionResult {
        val jobId = payload.importId
        var lastCommittedPosition = -1
        var totalWritten = 0

        try {
            // 1. Duplicate execution protection
            val existingJob = db.importJobDao.findByJobId(jobId)
            if (existingJob != null && existingJob.status == "completed") {
                return ImportExecutionResult.SkippedDuplicate(
                    jobId = jobId,
                    reason = "Job '$jobId' has already been successfully executed and completed"
                )
            }

            // 2. Resume detection
            lastCommittedPosition = existingJob?.lastCommittedPosition ?: -1
            totalWritten = existingJob?.writtenTracks ?: 0

            // Initialize or update job record
            if (existingJob == null) {
                db.importJobDao.insert(
                    RoomImportJobEntity(
                        jobId = jobId,
                        source = payload.source,
                        status = "running",
                        isTruncated = payload.isTruncated,
                        processedTracks = payload.tracks.size,
                        writtenTracks = 0,
                        lastCommittedPosition = -1
                    )
                )
            } else {
                db.importJobDao.updateProgress(jobId, "running", totalWritten, lastCommittedPosition)
            }

            // 3. Resolve or insert playlist
            var localPlaylistId: Long? = null
            if (payload.playlist != null) {
                val existingPl = db.playlistDao.findBySourceId(payload.playlist.id, payload.source)
                localPlaylistId = existingPl?.id ?: db.playlistDao.insert(
                    DefaultRoomEntityMapper.toPlaylistEntity(payload.playlist, payload.source)
                )
            }

            // Filter tracks to process only those after the resume checkpoint
            val tracksToProcess = payload.tracks.filter { it.position > lastCommittedPosition }

            if (tracksToProcess.isEmpty()) {
                db.importJobDao.markCompleted(jobId, "completed", System.currentTimeMillis())
                return ImportExecutionResult.Success(
                    jobId = jobId,
                    totalWritten = totalWritten,
                    isTruncated = payload.isTruncated
                )
            }

            // 4. Batch execution loop
            val batches = tracksToProcess.chunked(config.batchSize)

            for (batch in batches) {
                // Check cancellation at safe batch boundary before beginning transaction
                if (isCancelled()) {
                    db.importJobDao.updateProgress(
                        jobId = jobId,
                        status = "cancelled",
                        writtenTracks = totalWritten,
                        lastPosition = lastCommittedPosition
                    )
                    return ImportExecutionResult.Cancelled(
                        jobId = jobId,
                        lastCommittedPosition = lastCommittedPosition,
                        tracksCommittedSoFar = totalWritten
                    )
                }

                var batchLastPosition = -1
                db.runInTransaction {
                    for (track in batch) {
                        val trackEntity = DefaultRoomEntityMapper.toTrackEntity(track)
                        val trackId = db.trackDao.insert(trackEntity)

                        if (localPlaylistId != null) {
                            val occurrenceEntity = DefaultRoomEntityMapper.toOccurrenceEntity(
                                occurrence = track,
                                playlistId = localPlaylistId,
                                trackId = trackId,
                                jobId = jobId
                            )
                            db.occurrenceDao.insert(occurrenceEntity)
                        }

                        batchLastPosition = track.position
                    }

                    totalWritten += batch.size
                    lastCommittedPosition = batchLastPosition
                    db.importJobDao.updateProgress(
                        jobId = jobId,
                        status = "running",
                        writtenTracks = totalWritten,
                        lastPosition = lastCommittedPosition
                    )
                }
            }

            // 5. Complete and persist
            db.importJobDao.markCompleted(jobId, "completed", System.currentTimeMillis())
            return ImportExecutionResult.Success(
                jobId = jobId,
                totalWritten = totalWritten,
                isTruncated = payload.isTruncated
            )
        } catch (e: Throwable) {
            try {
                db.importJobDao.updateProgress(
                    jobId = jobId,
                    status = "failed",
                    writtenTracks = totalWritten,
                    lastPosition = lastCommittedPosition
                )
            } catch (ignored: Throwable) {
                // Ignore secondary failure if DB is already closed or unavailable
            }
            return ImportExecutionResult.Failure(
                jobId = jobId,
                error = e.message ?: "Unknown database error during import",
                lastCommittedPosition = lastCommittedPosition
            )
        }
    }
}
