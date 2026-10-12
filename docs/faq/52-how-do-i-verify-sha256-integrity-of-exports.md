# FAQ: How Do I Verify SHA-256 Integrity of Exports?

## Question
How do I verify the SHA-256 integrity of exported files?

## Answer
Run `music-import validate <file> --check-hash` or compute the hash using standard shasum tools and compare it against `manifest.json`.
