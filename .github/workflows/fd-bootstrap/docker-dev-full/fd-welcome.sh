#!/usr/bin/env bash
# Login-Banner für interaktive Shells. Gibt nichts aus, außer stdout ist ein Terminal
# (oder --force ist gesetzt), damit scp/sftp/`ssh host cmd` nie gestört werden. Kein Netzzugriff.
set -u

if [ "${1:-}" != "--force" ] && { [ ! -t 1 ] || [ ! -t 0 ]; }; then
    exit 0
fi

# shellcheck source=fd-status.sh
. "${FD_STATUS_LIB:-/usr/local/lib/fd-dev/fd-status.sh}" 2>/dev/null || exit 0

repo_dir="${FD_REPO_DIR:-${HOME}/frickeldave.github.io}"

cat <<BANNER

=== fd dev machine ===
  GitHub CLI logged in : $(fd_yes_no fd_gh_logged_in)
  Repository cloned    : $(fd_yes_no fd_repo_cloned) (${repo_dir})
  tmux installed       : $(fd_yes_no fd_tmux_installed)
  Copilot CLI logged in: $(fd_copilot_status)

  Run 'fd-setup' to log in and clone the repository (guided).
  Also in VS Code Remote-SSH: open a new terminal (Terminal > New Terminal) to see this banner.

  NOTE: all data lives in this container only. A restart or redeploy of the
  machine deletes it (logins, worktrees, unpushed work) - push regularly.

  Squad Remote Control: run 'squad rc --port 3000' here, then on your laptop:
    kubectl -n \${FD_NAMESPACE:-fd-infra} port-forward svc/fd-dev-<handle> 3000:3000

BANNER

if [ -z "${FD_SSH_PUBLIC_KEY:-}" ]; then
    cat <<NO_SSH
  This machine has no SSH key (no row in '## Developer SSH Keys'), so sshd is off.
  Shell access: kubectl -n \${FD_NAMESPACE:-fd-infra} exec -it fd-dev-<handle>-0 -c dev -- bash

NO_SSH
fi
