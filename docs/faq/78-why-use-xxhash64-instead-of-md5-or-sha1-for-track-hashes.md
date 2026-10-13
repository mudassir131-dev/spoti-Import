# FAQ: Why use xxHash64 instead of MD5 or SHA-1 for track hashing?

## Question
Why use xxHash64 instead of MD5 or SHA-1 for track hashing?

## Answer
Deduplication only requires collision resistance for unique identity checks, not cryptographic security. xxHash64 is up to 10x faster than SHA-1 and MD5, eliminating CPU bottlenecks while providing excellent distribution and virtually zero collision risk for music catalog fingerprints.
