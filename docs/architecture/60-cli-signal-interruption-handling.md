# Architecture Note 60: CLI Signal Interruption Handling

## Overview
Comprehensive architectural specification for CLI signal interruption handling within the Universal Music Import Engine.

## Key Principles
1. Process SIGINT and SIGTERM listener registration.
2. AbortSignal dispatching to ImportEngine.
3. Transactional rollback of incomplete batches.
4. Graceful exit with code 130.
