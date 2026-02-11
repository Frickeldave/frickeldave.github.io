# Branch Naming Strategy

## Overview

This document defines the standardized branch naming convention for the Frickeldave project. Following this convention ensures consistency, readability, and enables automation in our CI/CD pipeline.

## Branch Naming Format

```
<type>/<optional-ticket-id>-<description>
```

### Components

1. **Type** (required): The category of work
2. **Ticket ID** (optional): Issue or ticket reference
3. **Description** (required): Short, kebab-case description

## Branch Types

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature or functionality | `feat/user-authentication` |
| `fix` | Bug fix | `fix/sidebar-scrolling-issue` |
| `docs` | Documentation updates | `docs/update-branching-guide` |
| `style` | Code style changes | `style/format-components` |
| `refactor` | Code restructuring | `refactor/simplify-utils` |
| `perf` | Performance improvements | `perf/optimize-images` |
| `test` | Test additions/updates | `test/add-component-tests` |
| `ci` | CI/CD configuration | `ci/github-actions-security` |
| `chore` | Maintenance, dependencies | `chore/update-dependencies` |

## Examples

### Without Ticket ID
```
feat/dark-mode-support
fix/pagination-bug
docs/add-contribution-guide
ci/setup-automated-deployment
chore/update-tailwind-config
```

### With Ticket ID
```
feat/gh-123-user-authentication
fix/gh-456-button-alignment
docs/gh-789-update-readme
```

## Best Practices

1. **Use lowercase** - Always use lowercase letters
2. **Use hyphens** - Separate words with hyphens (kebab-case)
3. **Keep it short** - Branch names should be concise (max 50 characters)
4. **Be descriptive** - Make it clear what the branch does
5. **No spaces** - Never use spaces in branch names
6. **No underscores** - Use hyphens instead
7. **Match commit type** - Branch type should match future commit types

### ✅ Good Examples
```
feat/add-search-functionality
fix/modal-close-button
docs/api-documentation
ci/improve-build-workflow
chore/upgrade-react-version
```

### ❌ Bad Examples
```
feature/add_search_functionality    # Type should be 'feat', uses underscore
fix_modal_close_button              # No type prefix, uses underscore
DocsAPIDocumentation                # Uses PascalCase
temp-work                           # No type prefix
feature-branch                      # Type should come first
```

## Workflow Integration

1. **Create branch**: `git checkout -b feat/new-feature`
2. **Work on branch**: Make commits with Conventional Commits format
3. **Push branch**: `git push origin feat/new-feature`
4. **Create PR**: PR description should reference the branch type
5. **Merge**: Upon approval, merge to `dev` or `main`

## Automation Hooks

The following git hooks enforce this naming convention:

- **pre-push hook** (planned): Validates branch name before pushing
- **Commit message hook**: Ensures commits follow Conventional Commits format

## Related Documentation

- [Branching Strategy](./11-branching.md)
- [Conventional Commits](./11-branching.md#conventional-commits)
