# Technical Specification: Offline Mock Source Fixture

## Standard
Formal technical specification for offline mock source fixture.

## Conformance Criteria
All implementations must strictly conform to these invariants:
1. Mock source execution must not issue outbound network sockets.
2. Fixture data must conform to Universal ImportedTrack schema version 1.
3. All standard batching and pagination mechanics must be exercised identically.
