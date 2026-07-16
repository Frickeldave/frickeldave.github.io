---
name: tailwind-design-system
description: Tailwind styling rules and section-bound color-family consistency.
---

# Tailwind and Design System

Use for UI styling decisions and class updates.

## Key Rules

- Respect section-specific color families; do not mix families across sections.
- Keep shared layout/spacing/typography consistent with project design docs.
- Provide dark-mode variants for meaningful color changes.
- Prefer utility classes over inline styles.

## Avoid

- Raw hex colors inside components.
- Introducing new palette families without design-system update.
- Styling drift that breaks section identity.

## Gate

Visual redesigns or broad style updates require requirement approval first (Tony).
