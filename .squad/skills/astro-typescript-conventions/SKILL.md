---
name: astro-typescript-conventions
description: Astro/TypeScript architecture rules for pages, components, and strict typing in this repo.
---

# Astro and TypeScript Conventions

Use for changes in src/pages, src/components, and src/lib TypeScript modules.

## Key Rules

- Keep data loading in page level files; pass data to components via props.
- Follow strict TypeScript typing and avoid any where possible.
- Reuse collection types from src/content.config.ts and astro:content.
- Avoid edits in generated directories (dist, .astro, node_modules).

## Structural Guidance

- src/pages: routing and data queries.
- src/components: rendering and view composition.
- src/lib: pure helpers without Astro component coupling.

## Gate

For refactors or high-impact technical changes, obtain requirement approval first (Tony).
