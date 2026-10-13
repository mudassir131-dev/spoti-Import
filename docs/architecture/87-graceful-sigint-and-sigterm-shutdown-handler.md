# Architecture Note 87: Graceful SIGINT and SIGTERM Shutdown Handler

## Overview
Architectural blueprint for intercepting POSIX signals to guarantee clean transactional shutdown and checkpoint persistence.

## Key Principles
1. Registration of asynchronous signal traps for SIGINT and SIGTERM on engine initialization.
2. Immediate transition of active import state machine to CANCELLING state.
3. Flushing current in-flight batch transactions and persisting checkpoint metadata before exit.
4. Return of deterministic POSIX exit code 130 upon signal termination.
