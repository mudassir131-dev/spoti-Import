package org.universalmusic.importengine.bridge.validation

import org.universalmusic.importengine.bridge.models.MalformedInterchangeJsonException
import org.universalmusic.importengine.bridge.models.PayloadValidationException
import org.universalmusic.importengine.bridge.models.UnsupportedSchemaVersionException
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class InterchangeJsonParserTest {

    private val parser = InterchangeJsonParser()

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

    @Test
    fun testParseCanonicalV1Fixture() {
        val json = loadFixture("tests/fixtures/data/universal-interchange-v1-fixture.json")
        val payload = parser.parseAndValidate(json)

        assertEquals(1, payload.schemaVersion)
        assertEquals("import_test_fixture_001", payload.importId)
        assertEquals("spotify", payload.source)
        assertEquals("completed", payload.status)
        assertEquals(3, payload.tracks.size)

        // Playlist metadata
        assertNotNull(payload.playlist)
        assertEquals("Indie Classics", payload.playlist?.name)

        // Track 0 and Track 2 have same sourceId but distinct occurrenceId
        val track0 = payload.tracks[0]
        val track2 = payload.tracks[2]
        assertEquals("track_abc_123", track0.sourceId)
        assertEquals("track_abc_123", track2.sourceId)
        assertEquals("import_test_fixture_001:0", track0.occurrenceId)
        assertEquals("import_test_fixture_001:2", track2.occurrenceId)
        assertEquals(0, track0.position)
        assertEquals(2, track2.position)
    }

    @Test
    fun testParseEmptyPlaylist() {
        val json = loadFixture("tests/fixtures/data/interchange/empty-playlist.json")
        val payload = parser.parseAndValidate(json)

        assertEquals(0, payload.tracks.size)
        assertEquals("Empty Playlist", payload.playlist?.name)
    }

    @Test
    fun testParseFullMetadataPlaylist() {
        val json = loadFixture("tests/fixtures/data/interchange/full-metadata.json")
        val payload = parser.parseAndValidate(json)

        assertEquals(1, payload.tracks.size)
        val track = payload.tracks[0]
        assertEquals("Around the World", track.title)
        assertEquals(429000L, track.durationMs)
        assertEquals(1, track.discNumber)
        assertEquals(7, track.trackNumber)
        assertEquals(false, track.explicit)
        assertNotNull(track.metadata)
    }

    @Test
    fun testParseSpecialCharacters() {
        val json = loadFixture("tests/fixtures/data/interchange/special-characters.json")
        val payload = parser.parseAndValidate(json)

        assertEquals(2, payload.tracks.size)
        assertEquals("夜に駆ける (Racing into the Night)", payload.tracks[0].title)
        assertEquals("حبيبي (Habibi)", payload.tracks[1].title)
    }

    @Test
    fun testUnsupportedVersionV2ThrowsExplicitException() {
        val json = loadFixture("tests/fixtures/data/interchange/unsupported-version-v2.json")
        val ex = assertFailsWith<UnsupportedSchemaVersionException> {
            parser.parseAndValidate(json)
        }
        assertEquals(1, ex.expected)
        assertEquals(2, ex.actual)
    }

    @Test
    fun testMalformedMissingImportIdThrowsValidationException() {
        val json = loadFixture("tests/fixtures/data/interchange/malformed-missing-import-id.json")
        assertFailsWith<MalformedInterchangeJsonException> {
            parser.parseAndValidate(json)
        }
    }

    @Test
    fun testMalformedMissingSourceThrowsValidationException() {
        val json = loadFixture("tests/fixtures/data/interchange/malformed-missing-source.json")
        assertFailsWith<MalformedInterchangeJsonException> {
            parser.parseAndValidate(json)
        }
    }

    @Test
    fun testMalformedInvalidJsonSyntaxThrowsStructuredException() {
        val invalidJson = "{ invalid: json... missing quote "
        assertFailsWith<MalformedInterchangeJsonException> {
            parser.parseAndValidate(invalidJson)
        }
    }

    @Test
    fun testEmptyInputThrowsMalformedException() {
        assertFailsWith<MalformedInterchangeJsonException> {
            parser.parseAndValidate("   ")
        }
    }
}
