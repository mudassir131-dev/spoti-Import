package org.universalmusic.importengine.bridge.validation

import org.universalmusic.importengine.bridge.models.PayloadValidationException
import org.universalmusic.importengine.bridge.models.UniversalImportPayload
import org.universalmusic.importengine.bridge.models.UnsupportedSchemaVersionException

/**
 * Validates domain rules on decoded UniversalImportPayload instances.
 */
object InterchangeValidator {

    const val CURRENT_SCHEMA_VERSION = 1
    const val MAX_IMPORT_TRACKS = 10_000

    /**
     * Validates a UniversalImportPayload against domain constraints.
     * Throws typed exceptions upon violation.
     */
    fun validate(payload: UniversalImportPayload) {
        if (payload.schemaVersion != CURRENT_SCHEMA_VERSION) {
            throw UnsupportedSchemaVersionException(
                expected = CURRENT_SCHEMA_VERSION,
                actual = payload.schemaVersion
            )
        }

        if (payload.importId.isBlank()) {
            throw PayloadValidationException("importId", "must not be blank")
        }

        if (payload.source.isBlank()) {
            throw PayloadValidationException("source", "must not be blank")
        }

        if (payload.exportedAt.isBlank()) {
            throw PayloadValidationException("exportedAt", "must not be blank")
        }

        if (payload.tracks.size > MAX_IMPORT_TRACKS) {
            throw PayloadValidationException(
                "tracks",
                "Track count (${payload.tracks.size}) exceeds hard limit of $MAX_IMPORT_TRACKS"
            )
        }

        // Validate individual track occurrences
        var lastPosition = -1
        payload.tracks.forEachIndexed { index, track ->
            if (track.occurrenceId.isBlank()) {
                throw PayloadValidationException("tracks[$index].occurrenceId", "must not be blank")
            }

            if (track.position < 0) {
                throw PayloadValidationException("tracks[$index].position", "must be non-negative")
            }

            if (track.position < lastPosition) {
                throw PayloadValidationException(
                    "tracks[$index].position",
                    "tracks must be in strictly ascending playlist order; found ${track.position} after $lastPosition"
                )
            }
            lastPosition = track.position

            if (track.sourceId.isBlank()) {
                throw PayloadValidationException("tracks[$index].sourceId", "must not be blank")
            }

            if (track.title.isBlank()) {
                throw PayloadValidationException("tracks[$index].title", "must not be blank")
            }

            if (track.artists.isEmpty()) {
                throw PayloadValidationException("tracks[$index].artists", "must contain at least one artist")
            }

            track.artists.forEachIndexed { aIndex, artist ->
                if (artist.name.isBlank()) {
                    throw PayloadValidationException("tracks[$index].artists[$aIndex].name", "must not be blank")
                }
            }
        }
    }
}
