package org.universalmusic.importengine.bridge.room.mapping

import org.universalmusic.importengine.bridge.models.UniversalPlaylistMetadata
import org.universalmusic.importengine.bridge.models.UniversalTrackOccurrence
import org.universalmusic.importengine.bridge.room.entities.RoomPlaylistEntity
import org.universalmusic.importengine.bridge.room.entities.RoomPlaylistOccurrenceEntity
import org.universalmusic.importengine.bridge.room.entities.RoomTrackEntity

/**
 * Universal Entity Mapper interface.
 * Provides a clean architectural boundary so consumer music apps can map universal
 * import entities into their own proprietary schemas.
 */
interface ConsumerTrackMapper<T> {
    /**
     * Maps a universal track occurrence into the consuming application's proprietary track entity.
     */
    fun mapToAppTrack(occurrence: UniversalTrackOccurrence, localDbId: Long): T
}

/**
 * Default standard mapper converting universal models to Room entities.
 */
object DefaultRoomEntityMapper {

    fun toTrackEntity(occurrence: UniversalTrackOccurrence): RoomTrackEntity {
        val artistsJson = occurrence.artists.joinToString(separator = ",") { it.name }
        return RoomTrackEntity(
            sourceId = occurrence.sourceId,
            source = occurrence.source,
            title = occurrence.title,
            artistsJson = artistsJson,
            albumTitle = occurrence.album?.title,
            albumSourceId = occurrence.album?.sourceId,
            albumReleaseDate = occurrence.album?.releaseDate,
            albumArtwork = occurrence.album?.artwork,
            albumArtist = occurrence.albumArtist,
            durationMs = occurrence.durationMs,
            isrc = occurrence.isrc,
            trackNumber = occurrence.trackNumber,
            discNumber = occurrence.discNumber,
            explicit = occurrence.explicit,
            artwork = occurrence.artwork,
            metadataJson = occurrence.metadata?.toString()
        )
    }

    fun toPlaylistEntity(playlist: UniversalPlaylistMetadata, source: String): RoomPlaylistEntity {
        return RoomPlaylistEntity(
            sourceId = playlist.id,
            source = source,
            name = playlist.name,
            description = playlist.description,
            owner = playlist.owner,
            totalTracks = playlist.totalTracks,
            artwork = playlist.artwork,
            metadataJson = playlist.metadata?.toString()
        )
    }

    fun toOccurrenceEntity(
        occurrence: UniversalTrackOccurrence,
        playlistId: Long,
        trackId: Long,
        jobId: String
    ): RoomPlaylistOccurrenceEntity {
        return RoomPlaylistOccurrenceEntity(
            playlistId = playlistId,
            trackId = trackId,
            occurrenceId = occurrence.occurrenceId,
            position = occurrence.position,
            sourceId = occurrence.sourceId,
            addedAt = occurrence.addedAt,
            importJobId = jobId
        )
    }
}
