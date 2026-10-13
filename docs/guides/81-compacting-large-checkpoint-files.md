# Developer Guide 81: Compacting Large Checkpoint Files

## Objectives
Manage disk space and recovery speed by managing checkpoint compaction.

## Steps
1. Configure compaction threshold using `--checkpoint-compaction-interval 500`.
2. Monitor compaction events via verbose logging: `--verbose`.
3. Verify resumed imports properly start from latest compacted cursor offset.
