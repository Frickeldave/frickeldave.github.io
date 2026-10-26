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
