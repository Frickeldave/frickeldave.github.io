#!/usr/bin/env bash
# Idempotent: clones the repository once and leaves an existing checkout untouched.
set -euo pipefail

repo_url="${FD_REPO_URL:?FD_REPO_URL is required}"
repo_dir="${FD_REPO_DIR:?FD_REPO_DIR is required}"
repo_branch="${FD_REPO_BRANCH:-}"

if [ -d "${repo_dir}/.git" ]; then
    echo "fd-clone-repo: ${repo_dir} already contains a checkout."
    exit 0
fi

clone_args=()
if [ -n "${repo_branch}" ]; then
    clone_args+=(--branch "${repo_branch}")
fi

# `gh auth setup-git` makes git use the developer's `gh auth login` credentials.
if gh auth status >/dev/null 2>&1; then
    gh auth setup-git >/dev/null 2>&1 || true
fi

if ! GIT_TERMINAL_PROMPT=0 git clone "${clone_args[@]}" "${repo_url}" "${repo_dir}"; then
    echo "fd-clone-repo: clone failed (private repository?). Run 'gh auth login' and then 'fd-clone-repo'." >&2
    exit 1
fi
