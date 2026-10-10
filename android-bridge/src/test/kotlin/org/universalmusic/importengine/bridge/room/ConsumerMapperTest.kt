package org.universalmusic.importengine.bridge.room

import org.universalmusic.importengine.bridge.models.ImportedArtist
import org.universalmusic.importengine.bridge.models.UniversalTrackOccurrence
import org.universalmusic.importengine.bridge.room.mapping.ConsumerTrackMapper
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Mock proprietary entity belonging to a 3rd party music application.
 */
data class ThirdPartyCustomSong(
    val customSongId: String,
    val songTitle: String,
    val leadSinger: String,
    val playlistOrder: Int
)

class ConsumerMapperTest {

    @Test
    fun testConsumerCanMapUniversalOccurrenceToProprietarySchema() {
        val mapper = object : ConsumerTrackMapper<ThirdPartyCustomSong> {
            override fun mapToAppTrack(occurrence: UniversalTrackOccurrence, localDbId: Long): ThirdPartyCustomSong {
                return ThirdPartyCustomSong(
                    customSongId = "custom_$localDbId",
                    songTitle = occurrence.title,
                    leadSinger = occurrence.artists.firstOrNull()?.name ?: "Unknown",
                    playlistOrder = occurrence.position
                )
            }
        }

        val occurrence = UniversalTrackOccurrence(
            occurrenceId = "occ_10",
            position = 10,
            source = "spotify",
            sourceId = "sp_custom_track",
            title = "Stairway to Heaven",
            artists = listOf(ImportedArtist("Led Zeppelin"))
        )

        val appSong = mapper.mapToAppTrack(occurrence, localDbId = 42L)
        assertEquals("custom_42", appSong.customSongId)
        assertEquals("Stairway to Heaven", appSong.songTitle)
        assertEquals("Led Zeppelin", appSong.leadSinger)
        assertEquals(10, appSong.playlistOrder)
    }
}
