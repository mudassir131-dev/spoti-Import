# FAQ: Why Are Accented Characters Garbled Without UTF-8 BOM?

## Question
Why are accented characters garbled in Excel without UTF-8 BOM?

## Answer
Microsoft Excel defaults to legacy Windows ANSI encoding when opening CSV files unless a UTF-8 Byte Order Mark (0xEF, 0xBB, 0xBF) is present at the start of the file.
