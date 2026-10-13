# Architecture Note 88: Exponential Backoff with Decorrelated Jitter

## Overview
Resilience architecture utilizing Full Jitter and Decorrelated Jitter to disperse network thundering herds against Spotify Web API endpoints.

## Key Principles
1. Base retry interval set to 500ms with multiplier of 2.0x.
2. Sleep interval calculated as min(cap, random(base, sleep * 3)) preventing lockstep retries.
3. Priority parsing of HTTP 429 Retry-After headers overriding programmatic backoff calculation.
4. Bounded maximum delay ceiling of 30 seconds per attempt.
