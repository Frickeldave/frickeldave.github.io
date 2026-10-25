#!/usr/bin/env bash
# Sourced by fd-setup and fd-welcome. Offline checks only: no network access,
# no token is ever read into output.

fd_gh_logged_in() {
    if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
        return 0
    fi
    local hosts="${GH_CONFIG_DIR:-${XDG_CONFIG_HOME:-${HOME}/.config}/gh}/hosts.yml"
    [ -s "${hosts}" ] && grep -Eq '^github\.com:' "${hosts}" && grep -Eq '(oauth_token|user):' "${hosts}"
}

fd_repo_cloned() {
    git -C "${FD_REPO_DIR:-${HOME}/frickeldave.github.io}" rev-parse --is-inside-work-tree 2>/dev/null | grep -qx true
}

fd_tmux_installed() {
    command -v tmux >/dev/null 2>&1
}

# Shared with the start flows. Never run an interactive auth command here.
fd_runtime="${FD_RUNTIME_LIB:-$(dirname "${BASH_SOURCE[0]}")/copilot-environment.mjs}"
fd_copilot_status() {
    node "${fd_runtime}" auth 2>/dev/null || echo error
}

fd_yes_no() {
    if "$@"; then echo yes; else echo no; fi
}
