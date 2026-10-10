package org.universalmusic.importengine.bridge.validation

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import org.universalmusic.importengine.bridge.models.MalformedInterchangeJsonException
import org.universalmusic.importengine.bridge.models.UniversalImportPayload

/**
 * High-performance JSON parser for the Universal Import interchange format.
 */
class InterchangeJsonParser(
    private val json: Json = defaultJson
) {

    companion object {
        val defaultJson = Json {
            ignoreUnknownKeys = true
            isLenient = true
            coerceInputValues = true
            prettyPrint = false
        }
    }

    /**
     * Parses and validates a JSON string into a UniversalImportPayload.
     * Throws MalformedInterchangeJsonException, UnsupportedSchemaVersionException, or PayloadValidationException.
     */
    fun parseAndValidate(jsonString: String): UniversalImportPayload {
        if (jsonString.isBlank()) {
            throw MalformedInterchangeJsonException("JSON input string is empty or blank")
        }

        val payload = try {
            json.decodeFromString<UniversalImportPayload>(jsonString)
        } catch (e: SerializationException) {
            throw MalformedInterchangeJsonException(e.message ?: "Serialization error", e)
        } catch (e: IllegalArgumentException) {
            throw MalformedInterchangeJsonException(e.message ?: "Malformed JSON argument", e)
        } catch (e: Exception) {
            throw MalformedInterchangeJsonException("Failed to decode JSON: ${e.message}", e)
        }

        InterchangeValidator.validate(payload)
        return payload
    }
}
