#!/usr/bin/env bash
# Idempotent: klont das Repository einmal und lässt einen vorhandenen Checkout unangetastet.
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

# `gh auth setup-git` sorgt dafür, dass git die Zugangsdaten aus `gh auth login` nutzt.
if gh auth status >/dev/null 2>&1; then
    gh auth setup-git >/dev/null 2>&1 || true
fi

if ! GIT_TERMINAL_PROMPT=0 git clone "${clone_args[@]}" "${repo_url}" "${repo_dir}"; then
    echo "fd-clone-repo: clone failed (private repository?). Run 'gh auth login' and then 'fd-clone-repo'." >&2
    exit 1
fi
