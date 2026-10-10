package org.universalmusic.importengine.bridge.room

import org.universalmusic.importengine.bridge.room.adapter.UniversalRoomDatabaseAdapter
import org.universalmusic.importengine.bridge.room.entities.RoomTrackEntity
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class RoomMigrationTest {

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
    fun testMigrateV1ToV2PreservesExistingData() {
        assertEquals(1, db.schemaVersion)

        // Insert track under V1 schema
        val trackId = db.trackDao.insert(
            RoomTrackEntity(
                sourceId = "pre_migration_1",
                source = "spotify",
                title = "Classic Song",
                artistsJson = "The Band"
            )
        )

        // Run non-destructive migration
        db.migrateV1ToV2()
        assertEquals(2, db.schemaVersion)

        // Verify pre-existing track is still intact
        val retrieved = db.trackDao.findById(trackId)
        assertNotNull(retrieved)
        assertEquals("Classic Song", retrieved.title)
        assertEquals("pre_migration_1", retrieved.sourceId)

        // Insert new track after migration
        val postMigrationTrackId = db.trackDao.insert(
            RoomTrackEntity(
                sourceId = "post_migration_2",
                source = "spotify",
                title = "Modern Song",
                artistsJson = "New Artist"
            )
        )
        assertNotNull(db.trackDao.findById(postMigrationTrackId))
    }
}
