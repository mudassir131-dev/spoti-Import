# Architecture Note 73: NDJSON Newline-Delimited JSON Destination Adapter

## Overview
Comprehensive architectural specification for the NDJSON newline-delimited JSON destination adapter within the Universal Music Import Engine.

## Key Principles
1. Linear record-by-record serialization with trailing newline characters.
2. Direct piping into big data ingestion engines (BigQuery, Spark, Elasticsearch).
3. Zero array brackets or commas, ensuring zero V8 string rope fragmentation.
4. Idempotent flush boundaries per batch interval.
