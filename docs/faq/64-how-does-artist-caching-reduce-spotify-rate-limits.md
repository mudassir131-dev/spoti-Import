# FAQ: How Does Artist Caching Reduce Spotify Rate Limits?

## Question
How does artist caching reduce Spotify rate limits?

## Answer
Because multiple tracks on a playlist often share the same artist, in-memory LRU caching eliminates redundant HTTP requests for identical artist IDs, reducing API traffic by up to 40%.
