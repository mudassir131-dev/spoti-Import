# FAQ: When Should I Use NDJSON Instead of Standard JSON?

## Question
When should I use NDJSON instead of standard JSON?

## Answer
NDJSON (Newline-Delimited JSON) is ideal for streaming large datasets into data pipelines (Spark, BigQuery, Elasticsearch) because each line is an independent JSON object that can be processed without loading the full file into memory.
