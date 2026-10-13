# Developer Guide 76: Computing and Validating SHA256 Checksums

## Objectives
Learn how to compute and verify cryptographic SHA256 checksums for exported music files.

## Steps
1. Run import with checksum verification enabled: `music-import import <playlist> --checksum`.
2. Locate the generated SHA256 checksum recorded in `manifest.json`.
3. Verify file integrity using system CLI: `sha256sum <exported-file>` or `certutil -hashfile <exported-file> SHA256`.
