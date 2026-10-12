# FAQ: How Do I Open Exported CSV Files in Microsoft Excel?

## Question
How do I open exported CSV files in Microsoft Excel without character encoding issues?

## Answer
Export using the `--bom` flag (`music-import import <playlist> -f csv --bom`). Excel will automatically recognize the UTF-8 encoding.
