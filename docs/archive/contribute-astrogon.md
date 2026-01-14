# Contributing to Upstream Repositories from Your Fork

This guide explains how to properly contribute back to an upstream repository (astrogon/astrogon) when you've already made significant changes in your fork (frickeldave/frickeldave.github.io).

## Prerequisites

- Git installed and configured
- Your fork cloned locally
- Basic Git knowledge

## Initial Setup (One-Time)

### 1. Add Upstream Remote

```bash
# Add the original repository as upstream
git remote add upstream https://github.com/astrogon/astrogon.git

# Verify remotes
git remote -v
# Should show:
# origin    https://github.com/Frickeldave/frickeldave.github.io.git (fetch)
# origin    https://github.com/Frickeldave/frickeldave.github.io.git (push)
# upstream  https://github.com/astrogon/astrogon.git (fetch)
# upstream  https://github.com/astrogon/astrogon.git (push)

# Fetch upstream branches
git fetch upstream
```

## Contributing Workflow

### 2. Create Feature Branch from Upstream

For each contribution (bugfix, feature, improvement) you want to add to astrogon:

```bash
# Make sure you have the latest upstream changes
git fetch upstream

# Create a new branch from upstream/main
git checkout -b feature/my-contribution upstream/main

# Alternative naming conventions:
# git checkout -b bugfix/fix-navigation upstream/main
# git checkout -b feature/add-dark-mode upstream/main
# git checkout -b docs/update-readme upstream/main
```

### 3. Make Your Changes

```bash
# Make your changes in the code
# Test thoroughly

# Stage changes
git add .

# Commit with clear message
git commit -m "Fix: Description of what you fixed"
# or
git commit -m "Feature: Description of new feature"
```

### 4. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/my-contribution
```

Then:
1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Ensure the base repository is `astrogon/astrogon` and base branch is `develop`
4. Write a clear PR description
5. Submit the pull request

## Syncing Your Branches After Upstream Changes

### 5. Update Your Develop and Main Branches

After your PR is merged (or regularly to stay in sync):

```bash
# Update develop branch
git checkout develop
git fetch upstream
git merge upstream/main
git push origin develop

# Update main branch
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

## Summary

This workflow ensures:
- ✅ Clean, focused pull requests
- ✅ Easy review for upstream maintainers
- ✅ Your fork stays synchronized with upstream
- ✅ Minimal merge conflicts
- ✅ Professional contribution workflow

Happy contributing! 🚀