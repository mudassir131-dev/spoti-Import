# Developer Guide 67: Verifying Export Integrity with SHA-256 Checksums

## Objectives
Step-by-step guidance on verifying export integrity with sha256 checksums within the Universal Music Import Engine ecosystem.

## Steps
1. Open the finalized `manifest.json` and locate the checksum field.
2. Compute the local file hash using standard shell tools.
3. Alternatively, run `music-import validate <file> --check-hash` for automated verification.
