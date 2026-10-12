# Architecture Note 78: CLI Configuration Loader and Precedence Hierarchy

## Overview
Comprehensive architectural specification for CLI configuration loader and precedence hierarchy within the Universal Music Import Engine.

## Key Principles
1. Resolution hierarchy: CLI Flags > Environment Variables > Local Config > Global Config > Defaults.
2. Supported file formats: .musicimportrc and music-import.config.json.
3. Strict schema validation of configuration files via Zod domain schemas.
4. Silent fallback to defaults when configuration files are missing or unreadable.
