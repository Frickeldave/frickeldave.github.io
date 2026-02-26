# Commit Message Guidelines

This document describes the convention for commit messages in the Frickeldave repository. Following
these guidelines ensures a clear history and enables automation.

## Table of Contents

- [Commit Message Guidelines](#commit-message-guidelines)
  - [Conventional Commits](#conventional-commits)
    - [Commit Message Format](#commit-message-format)
    - [Types](#types)
    - [Examples](#examples)
    - [Automatic Validation](#automatic-validation)
    - [Scope (Optional)](#scope-optional)
  - [Help and Support](#help-and-support)

## Conventional Commits

This project enforces the **Conventional Commits** format for all commit messages using commitlint.
This standardization ensures:

- Clear commit history
- Automatic changelog generation
- Clear communication of changes
- Better integration with CI/CD tools

### Commit Message Format

```
<type>(<optional-scope>): <subject>

<optional-body>

<optional-footer>
```

### Types

| Type         | Purpose                                         | Example                                      |
| ------------ | ----------------------------------------------- | -------------------------------------------- |
| **feat**     | A new feature                                   | `feat(sidebar): add dark mode toggle`        |
| **fix**      | A bug fix                                       | `fix(pagination): correct page calculation`  |
| **docs**     | Documentation changes                           | `docs: update installation guide`            |
| **style**    | Code style (formatting, semicolons, whitespace) | `style: format code with Prettier`           |
| **refactor** | Code restructuring                              | `refactor(utils): simplify helper functions` |
| **perf**     | Performance improvements                        | `perf: optimize image loading`               |
| **test**     | Adding/updating tests                           | `test: add unit tests for auth`              |
| **ci**       | CI/CD configuration changes                     | `ci: update GitHub Actions workflow`         |
| **chore**    | Maintenance, dependencies                       | `chore: update dependencies`                 |

### Examples

✅ **Valid Commit Messages**

```bash
feat: add new authentication system
fix(blog): correct category filtering bug
docs: update README installation steps
ci(deploy): improve production workflow security
chore(deps): update all dependencies to latest
feat(ui): add dark mode support
fix(sidebar): resolve scrolling issue on mobile
refactor(api): simplify request handling
```

❌ **Invalid Commit Messages** (will be rejected)

```bash
added new feature              # Missing type
Fixed the bug                  # Wrong case
feat: Add new feature.         # Ends with period
asdfgh                         # No valid format
WIP on something               # Not conventional commits
```

### Automatic Validation

Our Git workflow includes automatic validation through **commitlint**:

- **Hook**: Runs on every commit as a Git pre-commit hook
- **Action**: Blocks commits that don't follow the format
- **Error Message**: Provides clear guidance on the correct format

If a commit is rejected:

1. Read the error message
2. Fix your commit message: `git commit --amend -m "correct: message"`
3. Try again

### Scope (Optional)

The scope indicates what part of the project was modified:

```bash
feat(sidebar): add navigation items       # Modify sidebar component
fix(blog): correct date formatting        # Fix in blog section
docs(config): update setup instructions   # Configuration docs
ci(deploy): improve workflow              # Deployment workflow
```

## Help and Support

If you have questions or problems regarding commit messages:

1. **Check documentation**: Read the existing guides.
2. **GitHub Discussions**: Ask questions in the community.
3. **Create issue**: Report problems directly in the repository.

Thank you for your contribution to the Frickeldave project!
