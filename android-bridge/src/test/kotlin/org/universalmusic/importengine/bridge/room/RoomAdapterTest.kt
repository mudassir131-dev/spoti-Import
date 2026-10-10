package org.universalmusic.importengine.bridge.room

import org.universalmusic.importengine.bridge.room.adapter.UniversalRoomDatabaseAdapter
import org.universalmusic.importengine.bridge.room.entities.RoomPlaylistEntity
import org.universalmusic.importengine.bridge.room.entities.RoomPlaylistOccurrenceEntity
import org.universalmusic.importengine.bridge.room.entities.RoomTrackEntity
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull

class RoomAdapterTest {

    private lateinit var db: UniversalRoomDatabaseAdapter

    @BeforeTest
    fun setUp() {
        db = UniversalRoomDatabaseAdapter()
    }

    @AfterTest
    fun tearDown() {
        db.close()
    }

    @Test
    fun testInsertTrackAndRetrieveBySourceId() {
        val track = RoomTrackEntity(
            sourceId = "sp_track_1",
            source = "spotify",
            title = "Bohemian Rhapsody",
            artistsJson = "Queen",
            durationMs = 354000
        )
        val id = db.trackDao.insert(track)
        assertNotEquals(-1L, id)

        val retrieved = db.trackDao.findBySourceId("sp_track_1", "spotify")
        assertNotNull(retrieved)
        assertEquals("Bohemian Rhapsody", retrieved.title)
        assertEquals(id, retrieved.id)
    }

    @Test
    fun testPreservesPlaylistOccurrencesAndOrder() {
        val plId = db.playlistDao.insert(
            RoomPlaylistEntity(
                sourceId = "pl_test",
                source = "spotify",
                name = "Test Playlist"
            )
        )

        val track1Id = db.trackDao.insert(
            RoomTrackEntity(sourceId = "tr_1", source = "spotify", title = "Song 1", artistsJson = "Art")
        )
        val track2Id = db.trackDao.insert(
            RoomTrackEntity(sourceId = "tr_2", source = "spotify", title = "Song 2", artistsJson = "Art")
        )

        // Song 1 at position 0, Song 2 at position 1, Song 1 repeated at position 2
        db.occurrenceDao.insert(
            RoomPlaylistOccurrenceEntity(
                playlistId = plId,
                trackId = track1Id,
                occurrenceId = "occ_0",
                position = 0,
                sourceId = "tr_1",
                importJobId = "job_1"
            )
        )
        db.occurrenceDao.insert(
            RoomPlaylistOccurrenceEntity(
                playlistId = plId,
                trackId = track2Id,
                occurrenceId = "occ_1",
                position = 1,
                sourceId = "tr_2",
                importJobId = "job_1"
            )
        )
        db.occurrenceDao.insert(
            RoomPlaylistOccurrenceEntity(
                playlistId = plId,
                trackId = track1Id,
                occurrenceId = "occ_2",
                position = 2,
                sourceId = "tr_1",
                importJobId = "job_1"
            )
        )

        val occurrences = db.occurrenceDao.getByPlaylistOrdered(plId)
        assertEquals(3, occurrences.size)
        assertEquals(0, occurrences[0].position)
        assertEquals(1, occurrences[1].position)
        assertEquals(2, occurrences[2].position)

        // Occurrence identity is distinct even though trackId is the same
        assertEquals(track1Id, occurrences[0].trackId)
        assertEquals(track1Id, occurrences[2].trackId)
        assertNotEquals(occurrences[0].id, occurrences[2].id)
        assertEquals("occ_0", occurrences[0].occurrenceId)
        assertEquals("occ_2", occurrences[2].occurrenceId)
    }

    @Test
    fun testTransactionRollsBackOnFailure() {
        val initialCount = db.trackDao.count()

        try {
            db.runInTransaction {
                db.trackDao.insert(
                    RoomTrackEntity(sourceId = "fail_1", source = "spotify", title = "Track 1", artistsJson = "Art")
                )
                throw RuntimeException("Simulated mid-transaction failure")
            }
        } catch (ignored: RuntimeException) {
        }

        val afterCount = db.trackDao.count()
        assertEquals(initialCount, afterCount)
    }
}
