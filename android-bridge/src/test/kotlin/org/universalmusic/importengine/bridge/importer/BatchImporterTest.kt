package org.universalmusic.importengine.bridge.importer

import org.universalmusic.importengine.bridge.models.ImportedArtist
import org.universalmusic.importengine.bridge.models.UniversalImportPayload
import org.universalmusic.importengine.bridge.models.UniversalPlaylistMetadata
import org.universalmusic.importengine.bridge.models.UniversalTrackOccurrence
import org.universalmusic.importengine.bridge.room.adapter.UniversalRoomDatabaseAdapter
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BatchImporterTest {

    private lateinit var db: UniversalRoomDatabaseAdapter
    private lateinit var importer: BatchImporter

    @BeforeTest
    fun setUp() {
        db = UniversalRoomDatabaseAdapter()
        importer = BatchImporter(db, BatchImporterConfig(batchSize = 2)) // small batch size to test chunking
    }

    @AfterTest
    fun tearDown() {
        db.close()
    }

    private fun generatePayload(count: Int, jobId: String = "job_batch_001"): UniversalImportPayload {
        val tracks = (0 until count).map { i ->
            UniversalTrackOccurrence(
                occurrenceId = "occ_$i",
                position = i,
                source = "spotify",
                sourceId = "track_$i",
                title = "Title $i",
                artists = listOf(ImportedArtist("Artist $i"))
            )
        }
        return UniversalImportPayload(
            schemaVersion = 1,
            importId = jobId,
            source = "spotify",
            playlist = UniversalPlaylistMetadata(id = "pl_1", name = "Test Pl", totalTracks = count),
            tracks = tracks,
            exportedAt = "2026-10-10T12:00:00Z"
        )
    }

    @Test
    fun testSuccessfulBatchImport() {
        val payload = generatePayload(5)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(5, result.totalWritten)
        assertEquals(5, db.trackDao.count())
    }

    @Test
    fun testDuplicateExecutionProtection() {
        val payload = generatePayload(3, "job_dup")
        val firstResult = importer.importPayload(payload)
        assertTrue(firstResult is ImportExecutionResult.Success)

        // Attempting to re-run the same job
        val secondResult = importer.importPayload(payload)
        assertTrue(secondResult is ImportExecutionResult.SkippedDuplicate)
        assertEquals("job_dup", secondResult.jobId)

        // Tracks must not have doubled
        assertEquals(3, db.trackDao.count())
    }

    @Test
    fun testCancellationBetweenBatchBoundaries() {
        val payload = generatePayload(10, "job_cancel")
        var callCount = 0

        // Cancel after the first batch (2 tracks) is committed
        val result = importer.importPayload(payload) {
            callCount++
            callCount >= 2
        }

        assertTrue(result is ImportExecutionResult.Cancelled)
        assertEquals("job_cancel", result.jobId)
        // First batch of 2 was written, remaining was cancelled
        assertEquals(2, db.trackDao.count())
    }

    @Test
    fun testResumeAfterRestartContinuesFromLastPosition() {
        val payload = generatePayload(6, "job_resume")

        // First run: cancel after 2 tracks (1st batch committed)
        var callCount = 0
        val cancelResult = importer.importPayload(payload) {
            callCount++
            callCount >= 2
        }
        assertTrue(cancelResult is ImportExecutionResult.Cancelled)
        assertEquals(2, db.trackDao.count())

        // Simulate restarting the application/service and re-running the same import
        val resumeResult = importer.importPayload(payload)
        assertTrue(resumeResult is ImportExecutionResult.Success)
        assertEquals(6, resumeResult.totalWritten)
        assertEquals(6, db.trackDao.count())
    }
}
