#!/usr/bin/env bash
set -euo pipefail

ssh_dir="${HOME}/.ssh"
sshd_dir="${HOME}/.sshd"
ssh_port="${FD_SSH_PORT:-2222}"
ready_marker="${HOME}/.fd-ready"
# FD_WELCOME_SHOWN holds the PID of the shell that printed the banner: nested shells stay quiet,
# while a stale value inherited from a dead SSH session (e.g. via the VS Code server) does not.
welcome_hook='case $- in *i*) if command -v fd-welcome >/dev/null 2>&1 && { [ -z "${FD_WELCOME_SHOWN:-}" ] || ! kill -0 "$FD_WELCOME_SHOWN" 2>/dev/null; }; then export FD_WELCOME_SHOWN=$$; fd-welcome; fi;; esac'
vscode_machine_dir="${HOME}/.vscode-server/data/Machine"

start_sshd() {
    install -d -m 0700 "${ssh_dir}" "${sshd_dir}"
    printf '%s\n' "${FD_SSH_PUBLIC_KEY}" > "${ssh_dir}/authorized_keys"
    chmod 0600 "${ssh_dir}/authorized_keys"

    if [ ! -f "${sshd_dir}/ssh_host_ed25519_key" ]; then
        ssh-keygen -q -t ed25519 -N '' -f "${sshd_dir}/ssh_host_ed25519_key"
    fi

    # sshd runs unprivileged as appuser: key login for this single user only.
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

# Container environment (repo settings) must be visible to SSH sessions and to
# interactive shells; both read the generated file.
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
    # Banner for interactive shells only; bash also sources .bashrc for `ssh host cmd` and scp.
    # Drop hook versions from older images, then append the current one exactly once.
    if [ -f "${HOME}/.bashrc" ]; then
        grep -vF 'fd-welcome' "${HOME}/.bashrc" > "${HOME}/.bashrc.tmp" || true
        cat "${HOME}/.bashrc.tmp" > "${HOME}/.bashrc"
        rm -f "${HOME}/.bashrc.tmp"
    fi
    echo "${welcome_hook}" >> "${HOME}/.bashrc"
}

# Defaults for VS Code Remote-SSH; never overwrite choices a developer already made.
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
    # Ready before any network work: a hanging or failing clone (private repo
    # before `gh auth login`) must never keep the machine from being usable.
    touch "${ready_marker}"

    # Background and bounded: the clone must not delay SSH/exec access, and an
    # unauthenticated clone of the private repository must not run forever.
    # `fd-clone-repo` (also run by fd-setup) retries once `gh auth login` succeeded.
    (timeout 120 fd-clone-repo > "${HOME}/.fd-clone.log" 2>&1 || true) &

    if [ -n "${FD_SSH_PUBLIC_KEY:-}" ]; then
        start_sshd
        exec /usr/sbin/sshd -D -e -f "${sshd_dir}/sshd_config"
    fi

    # No public key in .squad/team.md (## Developer SSH Keys): the machine exists
    # for `kubectl exec`/port-forward only, so no sshd and no authorized_keys.
    echo "No FD_SSH_PUBLIC_KEY set: sshd stays off. Access this machine with:" >&2
    echo "  kubectl -n \${FD_NAMESPACE:-fd-infra} exec -it \${HOSTNAME}-0 -c dev -- bash" >&2
    exec sleep infinity
fi

exec "$@"
