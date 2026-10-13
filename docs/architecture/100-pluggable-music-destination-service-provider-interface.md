# Architecture Note 100: Pluggable Music Destination SPI

## Overview
Architectural design for extensible MusicDestination Service Provider Interface (SPI) supporting 3rd-party destinations.

## Key Principles
1. Core decoupled interface defining `open()`, `writeTracks()`, `flush()`, and `close()` lifecycle methods.
2. Dynamic adapter discovery and instantiation via provider registry pattern.
3. Complete decoupling of destination adapters from CLI parser and core orchestration engine.
4. Native support for emerging storage backends (SQLite, NDJSON, Parquet, remote cloud storage).
