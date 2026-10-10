package org.universalmusic.importengine.bridge.models

/**
 * Structured exceptions for the Kotlin Android Bridge.
 */
sealed class BridgeException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/**
 * Thrown when the payload schemaVersion does not match CURRENT_SCHEMA_VERSION (1).
 */
class UnsupportedSchemaVersionException(
    val expected: Int,
    val actual: Int
) : BridgeException("Unsupported schemaVersion: expected $expected, received $actual")

/**
 * Thrown when interchange JSON cannot be parsed or is syntactically invalid.
 */
class MalformedInterchangeJsonException(
    message: String,
    cause: Throwable? = null
) : BridgeException("Malformed interchange JSON: $message", cause)

/**
 * Thrown when domain semantics fail validation (e.g. negative position, empty mandatory identifiers).
 */
class PayloadValidationException(
    val field: String,
    val reason: String
) : BridgeException("Validation failure on field '$field': $reason")
