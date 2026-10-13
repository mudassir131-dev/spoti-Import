# FAQ: How Often Does Checkpoint Compaction Run?

## Question
How often does checkpoint compaction run?

## Answer
Checkpoint compaction triggers automatically every 500 committed tracks to prune obsolete journal states and keep recovery files under 10KB.
