#!/usr/bin/env bash
# Wird von fd-setup und fd-welcome eingebunden. Nur Offline-Prüfungen: kein Netzzugriff,
# kein Token wird je in die Ausgabe gelesen.

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

# Gemeinsam mit den Start-Flows genutzt. Hier nie einen interaktiven Auth-Befehl ausführen.
fd_runtime="${FD_RUNTIME_LIB:-$(dirname "${BASH_SOURCE[0]}")/copilot-environment.mjs}"
fd_copilot_status() {
    node "${fd_runtime}" auth 2>/dev/null || echo error
}

fd_yes_no() {
    if "$@"; then echo yes; else echo no; fi
}

# BYOK-Status des Copilot-Providers (Issue #285): set | unset | invalid-permissions.
# Rein offline: geprüft werden nur Präsenz, Eigentümer und Rechte der beiden Dateien.
# Kein Key-Inhalt, keine Länge, kein Präfix, kein Hash in der Ausgabe.
fd_copilot_provider() {
    node "${fd_runtime}" provider --state 2>/dev/null || echo error
}

# Dieselbe Prüfung als eine Zeile für das Banner, z. B.
# "Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-flash".
fd_copilot_provider_line() {
    node "${fd_runtime}" provider --line 2>/dev/null || echo "Provider : unknown"
}

# --- Container-Diagnose (Issue #303) -----------------------------------------
# Die drei folgenden Funktionen laufen rein offline: kein Netzzugriff, kein
# kubectl, kein Token. Nicht Ermittelbares wird als "unknown" gemeldet, nie als 0.

# Bytes aus dem cgroup-Speicherlimit (/sys/fs/cgroup/memory.max, cgroup v2).
# Fallback auf cgroup v1; dort bedeutet ein riesiger Wert "unlimited".
fd_memory_limit() {
    local file value
    for file in "${FD_CGROUP_MEMORY_MAX:-/sys/fs/cgroup/memory.max}" \
        "${FD_CGROUP_MEMORY_LIMIT:-/sys/fs/cgroup/memory/memory.limit_in_bytes}"; do
        [ -r "${file}" ] || continue
        value=$(<"${file}") 2>/dev/null || continue
        value="${value//[[:space:]]/}"
        case "${value}" in
            '' | max) continue ;;
            *[!0-9]*) continue ;;
        esac
        # cgroup v1 meldet "unlimited" als 19-stelligen Wert.
        [ "${#value}" -ge 19 ] && continue
        echo "${value}"
        return 0
    done
    echo unknown
}

# Laufzeit des Containers in Sekunden. Vorrang hat das Alter der Ready-Marke
# ~/.fd-ready: der Entrypoint legt sie bei jedem Container-Start neu an, ihr
# mtime ist damit der verlässlichste Startzeitpunkt. Ohne Marke PID 1 (etimes).
# Beides ist offline lesbar.
fd_container_uptime() {
    local seconds ready mtime now
    ready="${HOME:-}/.fd-ready"
    if [ -n "${HOME:-}" ] && [ -r "${ready}" ]; then
        mtime=$(stat -c %Y "${ready}" 2>/dev/null || stat -f %m "${ready}" 2>/dev/null)
        now=$(date +%s 2>/dev/null)
        case "${mtime}" in
            '' | *[!0-9]*) ;;
            *)
                case "${now}" in
                    '' | *[!0-9]*) ;;
                    *)
                        seconds=$((now - mtime))
                        [ "${seconds}" -lt 0 ] && seconds=0
                        echo "${seconds}"
                        return 0
                        ;;
                esac
                ;;
        esac
    fi
    seconds=$(ps -p 1 -o etimes= 2>/dev/null | tr -cd '0-9')
    if [ -n "${seconds}" ]; then
        echo "${seconds}"
        return 0
    fi
    echo unknown
}

# Heuristik: Ein Dev-Container, der vor weniger als 600 s gestartet ist, wurde
# wahrscheinlich gerade neu gestartet (z. B. OOMKill, exitCode 137) - oder das
# ist ein frisch angelegter Pod. Mehr ist ohne Cluster-Zugriff nicht sagbar.
fd_restart_hint() {
    local seconds
    seconds=$(fd_container_uptime)
    case "${seconds}" in
        '' | *[!0-9]*) echo unknown ;;
        *)
            if [ "${seconds}" -lt 600 ]; then
                echo restart-suspected
            else
                echo ok
            fi
            ;;
    esac
}
