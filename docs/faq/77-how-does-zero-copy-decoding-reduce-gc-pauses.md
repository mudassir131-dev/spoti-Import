# FAQ: How does zero-copy decoding reduce garbage collection pauses?

## Question
How does zero-copy decoding reduce garbage collection pauses?

## Answer
Traditional string parsing creates temporary substring objects for every record, causing frequent V8 garbage collection cycles. Zero-copy decoding operates on raw TypedArray byte slices, transforming text in place and drastically cutting GC pauses during 10,000+ track imports.
