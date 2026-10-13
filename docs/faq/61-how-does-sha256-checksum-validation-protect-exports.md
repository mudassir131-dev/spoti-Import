# FAQ: How Does SHA256 Checksum Validation Protect Exports?

## Question
How does SHA256 checksum validation protect exports?

## Answer
By computing the cryptographic SHA256 hash concurrently during export and recording it in the manifest, users can verify that files were not corrupted during network transmission or interrupted disk writes.
