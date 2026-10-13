# ADR-099: Standardized Exit Codes for CI/CD Automation

## Status
Accepted

## Context
Automated CI/CD jobs and shell scripts need deterministic error differentiation without parsing standard error text.

## Decision
Define explicit exit code enumeration: 0=Success, 1=General error, 2=Config validation failure, 3=Authentication error, 4=Rate limited, 130=SIGINT.

## Consequences
- Enables robust bash/powershell script orchestration and targeted retry logic.
- Avoids ambiguous failure classifications in enterprise workflows.
