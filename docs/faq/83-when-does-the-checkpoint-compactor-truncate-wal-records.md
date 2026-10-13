# FAQ: When does the checkpoint compactor truncate historical WAL records?

## Question
When does the checkpoint compactor truncate historical WAL records?

## Answer
Compaction triggers when the WAL record count reaches a configured batch threshold (typically 500 batches) or upon successful import completion. The compactor creates an updated snapshot and safely truncates redundant predecessor logs.
