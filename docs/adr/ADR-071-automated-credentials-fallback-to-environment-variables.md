# ADR-071: Automated Credentials Fallback to Environment Variables

## Status
Accepted

## Context
Passing credentials directly as command-line arguments can expose them in shell history and process monitoring tools.

## Decision
Check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` environment variables automatically when flags are not explicitly provided.

## Consequences
- Secure credential management in server and container environments.
- Protects credentials from shell history exposure.
