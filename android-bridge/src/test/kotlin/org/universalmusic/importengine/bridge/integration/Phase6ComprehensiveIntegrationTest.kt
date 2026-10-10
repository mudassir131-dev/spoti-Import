package org.universalmusic.importengine.bridge.integration

import org.universalmusic.importengine.bridge.importer.BatchImporter
import org.universalmusic.importengine.bridge.importer.BatchImporterConfig
import org.universalmusic.importengine.bridge.importer.ImportExecutionResult
import org.universalmusic.importengine.bridge.models.*
import org.universalmusic.importengine.bridge.room.adapter.UniversalRoomDatabaseAdapter
import org.universalmusic.importengine.bridge.room.mapping.ConsumerTrackMapper
import org.universalmusic.importengine.bridge.validation.InterchangeJsonParser
import org.universalmusic.importengine.bridge.validation.InterchangeValidator
import java.io.File
import kotlin.test.*

/**
 * Phase 6 Comprehensive Integration Test Suite.
 *
 * Verifies all 17 required scenarios:
 * 1. Valid import manifest / payload
 * 2. Empty playlist
 * 3. Single track
 * 4. Multiple tracks
 * 5. Duplicate playlist occurrences
 * 6. Optional metadata
 * 7. Invalid JSON
 * 8. Unsupported schema version
 * 9. Import exceeding 10,000 tracks
 * 10. Exactly 10,000 tracks
 * 11. Interrupted batch
 * 12. Resume after restart
 * 13. Duplicate import execution
 * 14. Cancellation
 * 15. Database failure
 * 16. Preservation of playlist order
 * 17. Mapping into a consumer application's own Room entity
 */
class Phase6ComprehensiveIntegrationTest {

    private lateinit var db: UniversalRoomDatabaseAdapter
    private lateinit var importer: BatchImporter
    private val parser = InterchangeJsonParser()

    @BeforeTest
    fun setUp() {
        db = UniversalRoomDatabaseAdapter()
        importer = BatchImporter(db, BatchImporterConfig(batchSize = 250))
    }

    @AfterTest
    fun tearDown() {
        db.close()
    }

    private fun loadFixture(relativePath: String): String {
        val candidates = listOf(
            File(relativePath),
            File("../$relativePath"),
            File("../../$relativePath")
        )
        val file = candidates.firstOrNull { it.exists() }
            ?: throw IllegalStateException("Fixture file not found at $relativePath")
        return file.readText()
    }

    // Scenario 1: Valid import manifest / payload
    @Test
    fun scenario01_validImportManifest() {
        val json = loadFixture("tests/fixtures/data/universal-interchange-v1-fixture.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(3, result.totalWritten)
        assertEquals(3, db.trackDao.count())
    }

    // Scenario 2: Empty playlist
    @Test
    fun scenario02_emptyPlaylist() {
        val json = loadFixture("tests/fixtures/data/interchange/empty-playlist.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(0, result.totalWritten)
        assertEquals(0, db.trackDao.count())
    }

    // Scenario 3: Single track
    @Test
    fun scenario03_singleTrack() {
        val json = loadFixture("tests/fixtures/data/interchange/single-track.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(1, result.totalWritten)
        assertEquals(1, db.trackDao.count())
    }

    // Scenario 4: Multiple tracks
    @Test
    fun scenario04_multipleTracks() {
        val json = loadFixture("tests/fixtures/data/interchange/special-characters.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(2, result.totalWritten)
        assertEquals(2, db.trackDao.count())
    }

    // Scenario 5: Duplicate playlist occurrences
    @Test
    fun scenario05_duplicatePlaylistOccurrences() {
        val json = loadFixture("tests/fixtures/data/interchange/duplicate-tracks.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(3, result.totalWritten)

        val occurrences = db.occurrenceDao.getByJobOrdered(payload.importId)
        assertEquals(3, occurrences.size)
        // Check repeated sourceId at index 0 and 2
        assertEquals(occurrences[0].sourceId, occurrences[2].sourceId)
        assertNotEquals(occurrences[0].occurrenceId, occurrences[2].occurrenceId)
    }

    // Scenario 6: Optional metadata
    @Test
    fun scenario06_optionalMetadata() {
        val json = loadFixture("tests/fixtures/data/interchange/full-metadata.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        val track = db.trackDao.findBySourceId("sp_full_track", "spotify")
        assertNotNull(track)
        assertNotNull(track.metadataJson)
        assertEquals("Homework", track.albumTitle)
        assertEquals(1, track.discNumber)
    }

    // Scenario 7: Invalid JSON
    @Test
    fun scenario07_invalidJson() {
        val malformed = "{ this is completely invalid json: 123"
        assertFailsWith<MalformedInterchangeJsonException> {
            parser.parseAndValidate(malformed)
        }
    }

    // Scenario 8: Unsupported schema version
    @Test
    fun scenario08_unsupportedSchemaVersion() {
        val json = loadFixture("tests/fixtures/data/interchange/unsupported-version-v2.json")
        assertFailsWith<UnsupportedSchemaVersionException> {
            parser.parseAndValidate(json)
        }
    }

    // Scenario 9: Import exceeding 10,000 tracks
    @Test
    fun scenario09_importExceeding10000Tracks() {
        val tracks = (0..10_001).map { i ->
            UniversalTrackOccurrence(
                occurrenceId = "occ_$i",
                position = i,
                source = "spotify",
                sourceId = "t_$i",
                title = "Title $i",
                artists = listOf(ImportedArtist("Artist"))
            )
        }
        val payload = UniversalImportPayload(
            schemaVersion = 1,
            importId = "exceed_job",
            source = "spotify",
            tracks = tracks,
            exportedAt = "2026-10-10T12:00:00Z"
        )
        assertFailsWith<PayloadValidationException> {
            InterchangeValidator.validate(payload)
        }
    }

    // Scenario 10: Exactly 10,000 tracks
    @Test
    fun scenario10_exactly10000Tracks() {
        val tracks = (0 until 10_000).map { i ->
            UniversalTrackOccurrence(
                occurrenceId = "occ_$i",
                position = i,
                source = "spotify",
                sourceId = "t_$i",
                title = "Title $i",
                artists = listOf(ImportedArtist("Artist"))
            )
        }
        val payload = UniversalImportPayload(
            schemaVersion = 1,
            importId = "ten_thousand_job",
            source = "spotify",
            tracks = tracks,
            exportedAt = "2026-10-10T12:00:00Z"
        )

        // Must pass validation
        InterchangeValidator.validate(payload)

        // Import with batch size 1000
        val fastImporter = BatchImporter(db, BatchImporterConfig(batchSize = 2500))
        val result = fastImporter.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        assertEquals(10_000, result.totalWritten)
        assertEquals(10_000, db.trackDao.count())
    }

    // Scenario 11: Interrupted batch
    @Test
    fun scenario11_interruptedBatch() {
        val payload = UniversalImportPayload(
            schemaVersion = 1,
            importId = "job_interrupt",
            source = "spotify",
            tracks = (0 until 10).map { i ->
                UniversalTrackOccurrence(
                    occurrenceId = "occ_$i",
                    position = i,
                    source = "spotify",
                    sourceId = "t_$i",
                    title = "Title $i",
                    artists = listOf(ImportedArtist("Artist"))
                )
            },
            exportedAt = "2026-10-10T12:00:00Z"
        )

        val smallBatchImporter = BatchImporter(db, BatchImporterConfig(batchSize = 3))
        var iterations = 0
        val result = smallBatchImporter.importPayload(payload) {
            iterations++
            iterations >= 2 // Interrupt after first batch
        }

        assertTrue(result is ImportExecutionResult.Cancelled)
        assertEquals(3, db.trackDao.count())
    }

    // Scenario 12: Resume after restart
    @Test
    fun scenario12_resumeAfterRestart() {
        val payload = UniversalImportPayload(
            schemaVersion = 1,
            importId = "job_restart",
            source = "spotify",
            tracks = (0 until 6).map { i ->
                UniversalTrackOccurrence(
                    occurrenceId = "occ_$i",
                    position = i,
                    source = "spotify",
                    sourceId = "t_$i",
                    title = "Title $i",
                    artists = listOf(ImportedArtist("Artist"))
                )
            },
            exportedAt = "2026-10-10T12:00:00Z"
        )

        val smallBatchImporter = BatchImporter(db, BatchImporterConfig(batchSize = 2))
        var count = 0
        val cancelResult = smallBatchImporter.importPayload(payload) {
            count++
            count >= 2
        }
        assertTrue(cancelResult is ImportExecutionResult.Cancelled)
        assertEquals(2, db.trackDao.count())

        // Resume
        val resumeResult = smallBatchImporter.importPayload(payload)
        assertTrue(resumeResult is ImportExecutionResult.Success)
        assertEquals(6, resumeResult.totalWritten)
        assertEquals(6, db.trackDao.count())
    }

    // Scenario 13: Duplicate import execution
    @Test
    fun scenario13_duplicateImportExecution() {
        val json = loadFixture("tests/fixtures/data/interchange/single-track.json")
        val payload = parser.parseAndValidate(json)

        val first = importer.importPayload(payload)
        assertTrue(first is ImportExecutionResult.Success)

        val second = importer.importPayload(payload)
        assertTrue(second is ImportExecutionResult.SkippedDuplicate)
        assertEquals(1, db.trackDao.count())
    }

    // Scenario 14: Cancellation
    @Test
    fun scenario14_cancellation() {
        val json = loadFixture("tests/fixtures/data/universal-interchange-v1-fixture.json")
        val payload = parser.parseAndValidate(json)

        // Cancel immediately
        val result = importer.importPayload(payload) { true }
        assertTrue(result is ImportExecutionResult.Cancelled)
        assertEquals(0, db.trackDao.count())
    }

    // Scenario 15: Database failure
    @Test
    fun scenario15_databaseFailure() {
        // Closed DB triggers SQLException during batch write
        val brokenDb = UniversalRoomDatabaseAdapter()
        brokenDb.close()
        val brokenImporter = BatchImporter(brokenDb, BatchImporterConfig(batchSize = 10))

        val json = loadFixture("tests/fixtures/data/interchange/single-track.json")
        val payload = parser.parseAndValidate(json)

        val result = brokenImporter.importPayload(payload)
        assertTrue(result is ImportExecutionResult.Failure)
    }

    // Scenario 16: Preservation of playlist order
    @Test
    fun scenario16_preservationOfPlaylistOrder() {
        val json = loadFixture("tests/fixtures/data/universal-interchange-v1-fixture.json")
        val payload = parser.parseAndValidate(json)
        val result = importer.importPayload(payload)

        assertTrue(result is ImportExecutionResult.Success)
        val occurrences = db.occurrenceDao.getByJobOrdered(payload.importId)
        assertEquals(3, occurrences.size)
        assertEquals(0, occurrences[0].position)
        assertEquals(1, occurrences[1].position)
        assertEquals(2, occurrences[2].position)
    }

    // Scenario 17: Mapping into a consumer application's own Room entity
    @Test
    fun scenario17_mappingIntoConsumerAppEntity() {
        data class AppTrack(
            val appUuid: String,
            val songName: String,
            val artistsString: String
        )

        val mapper = object : ConsumerTrackMapper<AppTrack> {
            override fun mapToAppTrack(occurrence: UniversalTrackOccurrence, localDbId: Long): AppTrack {
                return AppTrack(
                    appUuid = "app_${occurrence.sourceId}_$localDbId",
                    songName = occurrence.title,
                    artistsString = occurrence.artists.joinToString { it.name }
                )
            }
        }

        val json = loadFixture("tests/fixtures/data/universal-interchange-v1-fixture.json")
        val payload = parser.parseAndValidate(json)
        val appTracks = payload.tracks.mapIndexed { idx, track ->
            mapper.mapToAppTrack(track, localDbId = (idx + 1).toLong())
        }

        assertEquals(3, appTracks.size)
        assertEquals("app_track_abc_123_1", appTracks[0].appUuid)
        assertEquals("Mr. Brightside", appTracks[0].songName)
        assertEquals("The Killers", appTracks[0].artistsString)
    }
}
