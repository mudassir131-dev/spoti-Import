# Developer Guide 100: Collecting and Exporting In-Memory Telemetry

## Overview
How to extract latency distributions, retry counts, and batch processing metrics from the telemetry circular buffer into Prometheus-compatible formats.

## Step-by-Step Instructions
1. Review the corresponding architecture specification and verify your runtime environment meets requirements.
2. Instantiate the required engine adapter or configuration flags as outlined in code examples.
3. Attach appropriate event listeners or abort signals to manage progress and cancellation cleanly.
4. Execute your pipeline and verify emitted telemetry counters match expected throughput baselines.

## Best Practices
- Always prefer streaming destinations over in-memory buffers for production runs.
- Ensure appropriate error handlers are attached to avoid unhandled promise rejections.
