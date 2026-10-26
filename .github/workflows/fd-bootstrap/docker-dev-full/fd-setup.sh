#!/usr/bin/env bash
# Geführtes, idempotentes Erstsetup. Anmeldungen bleiben bewusst interaktiv: Die Maschine
# enthält keine Secrets, daher meldet sich der Entwickler per Device-Flow an. Tokens werden nie ausgegeben.
#
# Einzige, ausdrücklich begrenzte Ausnahme ist der optionale Schritt 7/7 (Issue #285):
# Mit Opt-in legt er ~/.config/fd/copilot-provider.env und copilot-provider.key
# außerhalb des Repos an (Verzeichnis 0700, Dateien 0600). Ohne Opt-in entsteht keine
# dieser Dateien; der Key wird nie ausgegeben, geloggt oder in die History geschrieben.
set -u

usage() {
    cat <<'USAGE'
Usage: fd-setup [--help] [--reset-provider]

Guides through: gh login (with the read:project scope), git identity, clone of
frickeldave.github.io, npm install, Copilot login and - optionally - the DeepSeek
provider (BYOK). Safe to run repeatedly; completed steps are skipped.

No secret is written to disk, with one opt-in exception: step 7/7 stores the
DeepSeek key in $HOME/.config/fd/copilot-provider.key (0600) and the provider
configuration in $HOME/.config/fd/copilot-provider.env (0600, directory 0700).
Both files live outside the repository; no .env file is created and the key is
never written to .bash_history. Without step 7/7 the Copilot CLI keeps using
GitHub Copilot models.

  --reset-provider   Delete those two files, fall back to GitHub Copilot models
                     and print how to revoke the key at the provider.
                     Also offered non-interactively, e.g. from a broken session.

Non-interactive opt-in (no terminal): FD_SETUP_DEEPSEEK=1 with the key on stdin,
e.g. printf '%s\n' "$DEEPSEEK_KEY" | FD_SETUP_DEEPSEEK=1 fd-setup
An existing configuration is never overwritten without an explicit "y" answer.
USAGE
}

mode=setup
while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --reset-provider) mode=reset ;;
        *) usage >&2; exit 2 ;;
    esac
    shift
done

# shellcheck source=fd-status.sh
. "${FD_STATUS_LIB:-/usr/local/lib/fd-dev/fd-status.sh}"

repo_dir="${FD_REPO_DIR:-${HOME}/frickeldave.github.io}"
failed=0

step() { printf '\n[%s] %s\n' "$1" "$2"; }
abort() { echo "  $1" >&2; exit 1; }

# --- Optionaler BYOK-Provider (Issue #285) -------------------------------------
# Ablage außerhalb des Repos; Overrides existieren nur für Tests/CI.
provider_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/fd"
provider_config="${FD_COPILOT_PROVIDER_CONFIG:-${provider_dir}/copilot-provider.env}"
provider_key="${FD_COPILOT_API_KEY_FILE:-${provider_dir}/copilot-provider.key}"
provider_key_value=""
provider_answer=""
opt_in=0
case "${FD_SETUP_DEEPSEEK:-}" in
    1|yes|true) opt_in=1 ;;
esac

fd_interactive() { [ -t 0 ] && [ -t 1 ]; }

# Status/Zeile kommen aus dem Offline-Check in fd-status.sh; nie ein Key-Inhalt.
provider_state() { fd_copilot_provider; }
provider_line() { fd_copilot_provider_line; }

provider_notice() {
    cat <<NOTICE

  Optional: DeepSeek as the model provider (BYOK) for the Copilot CLI.
    - Off by default: only this step enables it. Without it every start flow keeps
      using the GitHub Copilot models, exactly as before.
    - Opt-in means that the CLI sends your prompts and the code context it reads to
      DeepSeek (host https://api.deepseek.com/anthropic) - a third party outside
      GitHub. Its terms for storage and training apply to that data.
    - The key is stored only on this machine in ${provider_dir}
      (directory 0700, files 0600), never in the repository and never in
      .bash_history. It is passed to the CLI as a file path, not as an env value.
    - Revoke it at https://platform.deepseek.com/api_keys; 'fd-setup --reset-provider'
      removes the local files. Deleting them does not revoke the key itself.
    - Fallback: without these files, with FD_COPILOT_PROVIDER=github or with
      '--no-provider' the start flows use GitHub Copilot again and print a warning.
NOTICE
}

provider_report() {
    state="$(provider_state)"
    case "${state}" in
        set)
            echo "  provider active."
            echo "  $(provider_line)"
            echo "  Override the model per run with e.g. 'npm run start-work -- --model deepseek-v4-pro'."
            ;;
        unset)
            echo "  provider is not active; the start flows use GitHub Copilot models." >&2
            ;;
        invalid-permissions)
            echo "  provider files found but rejected (expected: directory 0700, files 0600," >&2
            echo "  one sk-... key). Run 'node ${fd_runtime:-/usr/local/lib/fd-dev/copilot-environment.mjs} provider'" >&2
            echo "  and re-run 'fd-setup --reset-provider'." >&2
            ;;
        *)
            echo "  provider check failed (${state}); run" >&2
            echo "  'node ${fd_runtime:-/usr/local/lib/fd-dev/copilot-environment.mjs} provider' for details." >&2
            ;;
    esac
}

# Liest den Key ohne Echo. Gibt den Wert nie zurück, nur Erfolg/Misserfolg.
prompt_provider_key() {
    printf '  DeepSeek API key (input is not echoed): '
    IFS= read -rs provider_key_value || true
    printf '\n'
    provider_key_value="${provider_key_value%$'\r'}"
    validate_provider_key
}

validate_provider_key() {
    if [ -z "${provider_key_value}" ]; then
        echo "  no key entered; nothing was written." >&2
        return 1
    fi
    case "${provider_key_value}" in
        sk-*) ;;
        *)
            echo "  that does not look like a DeepSeek key (expected sk-...); nothing was written." >&2
            provider_key_value=""
            return 1
            ;;
    esac
    case "${provider_key_value}" in
        *[!A-Za-z0-9_-]*)
            echo "  the key contains characters outside A-Z a-z 0-9 _ -; nothing was written." >&2
            provider_key_value=""
            return 1
            ;;
    esac
    if [ "${#provider_key_value}" -lt 19 ] || [ "${#provider_key_value}" -gt 512 ]; then
        echo "  the key has an unexpected length; nothing was written." >&2
        provider_key_value=""
        return 1
    fi
    return 0
}

# Schreibt eine Datei mit exakt 0600; der Inhalt kommt über stdin und liegt bis zum
# install nur in einer per umask geschützten Temp-Datei im 0700-Verzeichnis.
write_private_file() {
    dest="$1"
    provider_tmp="${dest}.fd-setup.$$"
    ( umask 077; cat > "${provider_tmp}" ) || {
        echo "  cannot write ${provider_tmp}." >&2
        rm -f "${provider_tmp}"
        return 1
    }
    install -m 0600 "${provider_tmp}" "${dest}" || {
        echo "  cannot create ${dest}." >&2
        rm -f "${provider_tmp}"
        return 1
    }
    rm -f "${provider_tmp}"
    return 0
}

provider_config_text() {
    cat <<CONFIG
# fd Copilot provider (BYOK, Issue #285). Machine-local opt-in, never committed.
# Shared launch settings for the start flows; remove with 'fd-setup --reset-provider'.
FD_COPILOT_PROVIDER=deepseek
COPILOT_PROVIDER_TYPE=anthropic
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/anthropic
COPILOT_PROVIDER_API_KEY_FILE=${provider_key}
COPILOT_MODEL=deepseek-v4-flash
COPILOT_PROVIDER_MAX_PROMPT_TOKENS=840000
COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=128000
CONFIG
}

write_provider_files() {
    provider_parent="$(dirname "${provider_dir}")"
    if [ ! -d "${provider_parent}" ]; then
        install -d -m 0700 "${provider_parent}" || {
            echo "  cannot create ${provider_parent}." >&2
            return 1
        }
    fi
    install -d -m 0700 "${provider_dir}" || {
        echo "  cannot create ${provider_dir}." >&2
        return 1
    }
    printf '%s\n' "${provider_key_value}" | write_private_file "${provider_key}" || return 1
    provider_config_text | write_private_file "${provider_config}" || {
        # Ohne Konfigurationsdatei ist der Provider aus; ein übrig gebliebener Key
        # wäre nur noch eine ungenutzte Secret-Datei.
        rm -f "${provider_key}"
        return 1
    }
    provider_key_value=""
    return 0
}

provider_setup() {
    step 7/7 "Optional: DeepSeek provider (BYOK)"
    configured=0
    if [ -e "${provider_config}" ] || [ -L "${provider_config}" ]; then
        configured=1
    fi

    if [ "${configured}" = "1" ]; then
        echo "  already configured on this machine:"
        echo "  $(provider_line)"
        if [ "${opt_in}" = "1" ]; then
            echo "  FD_SETUP_DEEPSEEK is set; the existing files stay unchanged."
            provider_report
            return 0
        fi
        if ! fd_interactive; then
            echo "  no terminal; the existing files stay unchanged."
            provider_report
            return 0
        fi
        provider_notice
        printf '  Replace the stored key and configuration? [y/N] '
        provider_answer=""
        read -r provider_answer || true
        case "${provider_answer}" in
            y|Y|yes|YES)
                prompt_provider_key || return 0
                ;;
            *)
                echo "  kept the existing provider configuration."
                provider_report
                return 0
                ;;
        esac
    elif [ "${opt_in}" = "1" ]; then
        provider_notice
        echo "  FD_SETUP_DEEPSEEK is set: enabling the provider without a further prompt."
        if fd_interactive; then
            prompt_provider_key || return 0
        else
            provider_key_value=""
            IFS= read -rs provider_key_value || true
            provider_key_value="${provider_key_value%$'\r'}"
            validate_provider_key || return 0
        fi
    elif fd_interactive; then
        provider_notice
        printf '  Enable the DeepSeek provider now? [y/N] '
        provider_answer=""
        read -r provider_answer || true
        case "${provider_answer}" in
            y|Y|yes|YES)
                prompt_provider_key || return 0
                ;;
            *)
                echo "  skipped; GitHub Copilot models stay active and no file was created."
                return 0
                ;;
        esac
    else
        echo "  skipped (no terminal). Opt in with FD_SETUP_DEEPSEEK=1 and the key on stdin,"
        echo "  or run 'fd-setup' interactively. No file was created."
        return 0
    fi

    write_provider_files || return 0
    provider_report
}

reset_provider() {
    step 7/7 "Reset: DeepSeek provider"
    removed=0
    for file in "${provider_config}" "${provider_key}"; do
        if [ -e "${file}" ] || [ -L "${file}" ]; then
            if rm -f "${file}"; then
                echo "  removed ${file}"
                removed=1
            else
                echo "  could not remove ${file}." >&2
                exit 1
            fi
        fi
    done
    if [ "${removed}" = "0" ]; then
        echo "  nothing to remove; the provider was not configured."
    else
        rmdir "${provider_dir}" 2>/dev/null || true
    fi
    echo "  the start flows use GitHub Copilot models again (no config = opt-out)."
    cat <<'REVOKE'

The local files are gone, but the key itself stays valid on the server until you
revoke it there - do that as well if the key was exposed or is no longer needed:
  https://platform.deepseek.com/api_keys
Data already sent to the provider is not removed by this reset.
REVOKE
}

if [ "${mode}" = "reset" ]; then
    reset_provider
    exit 0
fi

cat <<'EXPLAIN'
Why you have to authenticate more than once:
  1. "gh auth login" signs the GitHub CLI in (needed to clone the private repository).
  2. "gh auth refresh -s read:project" adds the read:project scope, which the start flows
     need to read the GitHub Project board. GitHub only grants it in a second device flow.
  3. "copilot login" signs the Copilot CLI in separately.
EXPLAIN

step 1/7 "GitHub CLI login"
if fd_gh_logged_in || gh auth status >/dev/null 2>&1; then
    echo "  already logged in."
else
    echo "  starting device flow; open the shown URL in your browser and enter the code."
    gh auth login --hostname github.com --git-protocol https --web \
        || abort "gh login failed or was cancelled; re-run 'fd-setup'."
fi

step 2/7 "GitHub scope read:project"
if ! gh auth status 2>&1 | grep -q 'read:project'; then
    gh auth refresh --hostname github.com -s read:project \
        || abort "gh auth refresh -s read:project failed; re-run 'fd-setup'."
fi
gh auth status 2>&1 | grep -q 'read:project' \
    || abort "The read:project scope is still missing. Run 'gh auth refresh -s read:project' and re-run 'fd-setup'."
echo "  read:project scope present."
gh auth setup-git && echo "  git uses your gh login for HTTPS."

step 3/7 "Git identity"
gh_login="$(gh api user --jq '.login // empty' 2>/dev/null)" || gh_login=""
gh_id="$(gh api user --jq '.id // empty' 2>/dev/null)" || gh_id=""
gh_name="$(gh api user --jq '.name // empty' 2>/dev/null)" || gh_name=""
gh_email="$(gh api user --jq '.email // empty' 2>/dev/null)" || gh_email=""
[ -n "${gh_login}" ] || abort "Could not read the GitHub user from 'gh api user'."
[ -n "${gh_name}" ] || gh_name="${gh_login}"
if [ -z "${gh_email}" ]; then
    [ -n "${gh_id}" ] || abort "Could not read an e-mail address or user id from 'gh api user'."
    gh_email="${gh_id}+${gh_login}@users.noreply.github.com"
fi
git config --global user.name "${gh_name}" && git config --global user.email "${gh_email}" \
    || abort "Could not set git user.name/user.email."
echo "  git identity: ${gh_name} <${gh_email}>"

step 4/7 "Repository clone"
FD_REPO_URL="${FD_REPO_URL:?FD_REPO_URL is required}" FD_REPO_DIR="${repo_dir}" \
    FD_REPO_BRANCH="${FD_REPO_BRANCH:-}" fd-clone-repo \
    || abort "The clone failed; fix the error above and re-run 'fd-setup'."

step 5/7 "npm install in frickeldave.github.io"
(cd "${repo_dir}" && npm ci) || (cd "${repo_dir}" && npm install) \
    || abort "npm install failed in ${repo_dir}."

step 6/7 "Copilot CLI login"
case "$(fd_copilot_status)" in
    yes) echo "  already logged in." ;;
    no)
        if fd_interactive; then
            copilot login || echo "  copilot login did not complete; run 'copilot login' later." >&2
        else
            echo "  not logged in. Run 'copilot login' in an interactive shell."
        fi
        ;;
    unavailable) echo "  Copilot CLI unavailable; install @github/copilot, then run 'copilot login'." >&2 ;;
    unsupported) echo "  Copilot CLI version/config unsupported; update the CLI and recheck." >&2 ;;
    *) echo "  Copilot login check failed; check CLI/config permissions, then re-run 'fd-welcome --force'." >&2 ;;
esac

node "${fd_runtime}" terminal || echo "  Could not configure Copilot terminal; use /terminal-setup." >&2

provider_setup

cat <<NEXT

Next steps:
  cd ${repo_dir}
  Start the flow (see scripts/README.md):
    node scripts/start-reqeng.mjs
    node scripts/start-work.mjs
    node scripts/start-review.mjs
  Optional Squad Remote Control (use tmux so it survives disconnects):
    squad rc --port 3000
  Then on your laptop: kubectl -n \${FD_NAMESPACE:-fd-infra} port-forward svc/fd-dev-<handle> 3000:3000
NEXT

exit 0
