#!/usr/bin/env bash
set -euo pipefail

ssh_dir="${HOME}/.ssh"
sshd_dir="${HOME}/.sshd"
ssh_port="${FD_SSH_PORT:-2222}"
ready_marker="${HOME}/.fd-ready"
# FD_WELCOME_SHOWN enthält die PID der Shell, die das Banner ausgegeben hat: verschachtelte Shells bleiben still,
# ein veralteter Wert aus einer beendeten SSH-Sitzung (z. B. über den VS-Code-Server) dagegen nicht.
welcome_hook='case $- in *i*) if command -v fd-welcome >/dev/null 2>&1 && { [ -z "${FD_WELCOME_SHOWN:-}" ] || ! kill -0 "$FD_WELCOME_SHOWN" 2>/dev/null; }; then export FD_WELCOME_SHOWN=$$; fd-welcome; fi;; esac'
vscode_machine_dir="${HOME}/.vscode-server/data/Machine"

start_sshd() {
    install -d -m 0700 "${ssh_dir}" "${sshd_dir}"
    printf '%s\n' "${FD_SSH_PUBLIC_KEY}" > "${ssh_dir}/authorized_keys"
    chmod 0600 "${ssh_dir}/authorized_keys"

    if [ ! -f "${sshd_dir}/ssh_host_ed25519_key" ]; then
        ssh-keygen -q -t ed25519 -N '' -f "${sshd_dir}/ssh_host_ed25519_key"
    fi

    # sshd läuft unprivilegiert als appuser: Key-Login nur für diesen einen Nutzer.
    cat > "${sshd_dir}/sshd_config" <<CONFIG
Port ${ssh_port}
HostKey ${sshd_dir}/ssh_host_ed25519_key
PidFile ${sshd_dir}/sshd.pid
AuthorizedKeysFile ${ssh_dir}/authorized_keys
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
UsePAM no
AllowUsers $(id -un)
PrintMotd no
CONFIG
}

# Die Container-Umgebung (Repo-Einstellungen) muss für SSH-Sitzungen und
# interaktive Shells sichtbar sein; beide lesen die erzeugte Datei.
write_container_env() {
    {
        echo "export FD_REPO_URL='${FD_REPO_URL:-}'"
        echo "export FD_REPO_DIR='${FD_REPO_DIR:-}'"
        echo "export FD_REPO_BRANCH='${FD_REPO_BRANCH:-}'"
    } > "${HOME}/.fd-env"
    grep -qxF '[ -f "$HOME/.fd-env" ] && . "$HOME/.fd-env"' "${HOME}/.bashrc" 2>/dev/null \
        || echo '[ -f "$HOME/.fd-env" ] && . "$HOME/.fd-env"' >> "${HOME}/.bashrc"
    grep -qxF '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"' "${HOME}/.profile" 2>/dev/null \
        || echo '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"' >> "${HOME}/.profile"
    # Banner nur für interaktive Shells; bash liest .bashrc auch für `ssh host cmd` und scp.
    # Hook-Versionen älterer Images entfernen, dann den aktuellen genau einmal anhängen.
    if [ -f "${HOME}/.bashrc" ]; then
        grep -vF 'fd-welcome' "${HOME}/.bashrc" > "${HOME}/.bashrc.tmp" || true
        cat "${HOME}/.bashrc.tmp" > "${HOME}/.bashrc"
        rm -f "${HOME}/.bashrc.tmp"
    fi
    echo "${welcome_hook}" >> "${HOME}/.bashrc"
}

# Defaults für VS Code Remote-SSH; bereits getroffene Entscheidungen nie überschreiben.
write_vscode_machine_settings() {
    local settings="${vscode_machine_dir}/settings.json"
    [ -e "${settings}" ] && return 0
    install -d -m 0755 "${vscode_machine_dir}"
    cat > "${settings}" <<'SETTINGS'
{
    "workbench.startupEditor": "none",
    "terminal.integrated.defaultProfile.linux": "bash",
    "terminal.integrated.inheritEnv": false,
    "terminal.integrated.enablePersistentSessions": true
}
SETTINGS
    chmod 0644 "${settings}"
}

if [ "${1:-}" = "sshd" ]; then
    write_container_env
    write_vscode_machine_settings
    # Ready vor jeglicher Netzwerk-Arbeit: Ein hängender oder fehlschlagender Clone (privates Repo
    # vor `gh auth login`) darf die Maschine nie unbenutzbar machen.
    touch "${ready_marker}"

    # Im Hintergrund und zeitlich begrenzt: Der Clone darf SSH-/exec-Zugang nicht verzögern,
    # und ein unauthentifizierter Clone des privaten Repos darf nicht endlos laufen.
    # `fd-clone-repo` (auch von fd-setup aufgerufen) versucht es nach `gh auth login` erneut.
    (timeout 120 fd-clone-repo > "${HOME}/.fd-clone.log" 2>&1 || true) &

    if [ -n "${FD_SSH_PUBLIC_KEY:-}" ]; then
        start_sshd
        exec /usr/sbin/sshd -D -e -f "${sshd_dir}/sshd_config"
    fi

    # Kein öffentlicher Schlüssel in .squad/team.md (## Developer SSH Keys): Die Maschine
    # dient nur `kubectl exec`/Port-Forward, also kein sshd und keine authorized_keys.
    echo "No FD_SSH_PUBLIC_KEY set: sshd stays off. Access this machine with:" >&2
    echo "  kubectl -n \${FD_NAMESPACE:-fd-infra} exec -it \${HOSTNAME}-0 -c dev -- bash" >&2
    exec sleep infinity
fi

exec "$@"
