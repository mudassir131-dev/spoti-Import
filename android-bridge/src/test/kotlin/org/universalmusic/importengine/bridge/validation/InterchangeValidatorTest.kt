package org.universalmusic.importengine.bridge.validation

import org.universalmusic.importengine.bridge.models.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class InterchangeValidatorTest {

    private fun sampleTrack(
        occurrenceId: String = "occ_0",
        position: Int = 0,
        sourceId: String = "trk_1",
        title: String = "Song A",
        artists: List<ImportedArtist> = listOf(ImportedArtist("Artist A"))
    ) = UniversalTrackOccurrence(
        occurrenceId = occurrenceId,
        position = position,
        source = "spotify",
        sourceId = sourceId,
        title = title,
        artists = artists
    )

    private fun validPayload(
        schemaVersion: Int = 1,
        importId: String = "job_001",
        source: String = "spotify",
        tracks: List<UniversalTrackOccurrence> = listOf(sampleTrack())
    ) = UniversalImportPayload(
        schemaVersion = schemaVersion,
        importId = importId,
        source = source,
        exportedAt = "2026-10-10T12:00:00Z",
        tracks = tracks
    )

    @Test
    fun testValidPayloadPassesValidation() {
        val payload = validPayload()
        // Should not throw
        InterchangeValidator.validate(payload)
    }

    @Test
    fun testUnsupportedSchemaVersionThrowsExplicitException() {
        val payload = validPayload(schemaVersion = 2)
        val ex = assertFailsWith<UnsupportedSchemaVersionException> {
            InterchangeValidator.validate(payload)
        }
        assertEquals(1, ex.expected)
        assertEquals(2, ex.actual)
    }

    @Test
    fun testBlankImportIdThrowsValidationException() {
        val payload = validPayload(importId = "  ")
        val ex = assertFailsWith<PayloadValidationException> {
            InterchangeValidator.validate(payload)
        }
        assertEquals("importId", ex.field)
    }

    @Test
    fun testBlankSourceThrowsValidationException() {
        val payload = validPayload(source = "")
        val ex = assertFailsWith<PayloadValidationException> {
            InterchangeValidator.validate(payload)
        }
        assertEquals("source", ex.field)
    }

    @Test
    fun testTrackCountExceedingCeilingFailsValidation() {
        val largeTracks = (0..10_005).map { index ->
            sampleTrack(occurrenceId = "occ_$index", position = index)
        }
        val payload = validPayload(tracks = largeTracks)
        val ex = assertFailsWith<PayloadValidationException> {
            InterchangeValidator.validate(payload)
        }
        assertEquals("tracks", ex.field)
        assertTrue(ex.reason.contains("10000"))
    }

    @Test
    fun testNonAscendingTrackPositionsThrowsValidationException() {
        val tracks = listOf(
            sampleTrack(occurrenceId = "occ_0", position = 5),
            sampleTrack(occurrenceId = "occ_1", position = 2) // Disordered!
        )
        val payload = validPayload(tracks = tracks)
        val ex = assertFailsWith<PayloadValidationException> {
            InterchangeValidator.validate(payload)
        }
        assertTrue(ex.reason.contains("playlist order"))
    }

    @Test
    fun testTrackWithEmptyArtistsThrowsValidationException() {
        val tracks = listOf(
            sampleTrack(artists = emptyList())
        )
        val payload = validPayload(tracks = tracks)
        val ex = assertFailsWith<PayloadValidationException> {
            InterchangeValidator.validate(payload)
        }
        assertTrue(ex.reason.contains("at least one artist"))
    }
}
