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

# Diagnosewerte (Issue #303) einmal ermitteln; alles rein offline.
memory_bytes=$(fd_memory_limit 2>/dev/null || echo unknown)
uptime_seconds=$(fd_container_uptime 2>/dev/null || echo unknown)
restart_hint=$(fd_restart_hint 2>/dev/null || echo unknown)

case "${memory_bytes}" in
    '' | *[!0-9]*) memory_display="unknown" ;;
    *)
        if [ "${memory_bytes}" -ge 1073741824 ]; then
            memory_display="${memory_bytes} bytes ($((memory_bytes / 1073741824)) GiB)"
        elif [ "${memory_bytes}" -ge 1048576 ]; then
            memory_display="${memory_bytes} bytes ($((memory_bytes / 1048576)) MiB)"
        else
            memory_display="${memory_bytes} bytes"
        fi
        ;;
esac

case "${uptime_seconds}" in
    '' | *[!0-9]*) uptime_display="unknown" ;;
    *) uptime_display="${uptime_seconds} s" ;;
esac

# Dieselbe 600-s-Schwelle wie fd_restart_hint: ein so junger Container wurde
# wahrscheinlich gerade neu gestartet (z. B. OOMKill, exitCode 137).
warn_line=""
case "${uptime_seconds}" in
    '' | *[!0-9]*) ;;
    *)
        if [ "${uptime_seconds}" -lt 600 ]; then
            warn_line=$'\n  WARN: container uptime < 600 s — restart suspected'
        fi
        ;;
esac

cat <<BANNER

=== fd dev machine ===
  GitHub CLI logged in : $(fd_yes_no fd_gh_logged_in)
  Repository cloned    : $(fd_yes_no fd_repo_cloned) (${repo_dir})
  tmux installed       : $(fd_yes_no fd_tmux_installed)
  Copilot CLI logged in: $(fd_copilot_status)
  $(fd_copilot_provider_line)

  Container-Uptime: ${uptime_display}
  Memory-Limit: ${memory_display}
  Restart: ${restart_hint}${warn_line}

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
