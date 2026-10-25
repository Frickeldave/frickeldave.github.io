#!/usr/bin/env bash
# Guided, idempotent first-time setup. Logins stay interactive on purpose: the machine
# holds no secrets, so the developer authenticates via device flow. Tokens are never printed.
set -u

usage() {
    cat <<'USAGE'
Usage: fd-setup [--help]

Guides through: gh login (with the read:project scope), git identity, clone of
frickeldave.github.io, npm install and Copilot login.
Safe to run repeatedly; completed steps are skipped. No secret is written to disk
and no .env file is created.
USAGE
}

case "${1:-}" in
    -h|--help) usage; exit 0 ;;
    "") ;;
    *) usage >&2; exit 2 ;;
esac

# shellcheck source=fd-status.sh
. "${FD_STATUS_LIB:-/usr/local/lib/fd-dev/fd-status.sh}"

repo_dir="${FD_REPO_DIR:-${HOME}/frickeldave.github.io}"
failed=0

step() { printf '\n[%s] %s\n' "$1" "$2"; }
abort() { echo "  $1" >&2; exit 1; }

cat <<'EXPLAIN'
Why you have to authenticate more than once:
  1. "gh auth login" signs the GitHub CLI in (needed to clone the private repository).
  2. "gh auth refresh -s read:project" adds the read:project scope, which the start flows
     need to read the GitHub Project board. GitHub only grants it in a second device flow.
  3. "copilot login" signs the Copilot CLI in separately.
EXPLAIN

step 1/6 "GitHub CLI login"
if fd_gh_logged_in || gh auth status >/dev/null 2>&1; then
    echo "  already logged in."
else
    echo "  starting device flow; open the shown URL in your browser and enter the code."
    gh auth login --hostname github.com --git-protocol https --web \
        || abort "gh login failed or was cancelled; re-run 'fd-setup'."
fi

step 2/6 "GitHub scope read:project"
if ! gh auth status 2>&1 | grep -q 'read:project'; then
    gh auth refresh --hostname github.com -s read:project \
        || abort "gh auth refresh -s read:project failed; re-run 'fd-setup'."
fi
gh auth status 2>&1 | grep -q 'read:project' \
    || abort "The read:project scope is still missing. Run 'gh auth refresh -s read:project' and re-run 'fd-setup'."
echo "  read:project scope present."
gh auth setup-git && echo "  git uses your gh login for HTTPS."

step 3/6 "Git identity"
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

step 4/6 "Repository clone"
FD_REPO_URL="${FD_REPO_URL:?FD_REPO_URL is required}" FD_REPO_DIR="${repo_dir}" \
    FD_REPO_BRANCH="${FD_REPO_BRANCH:-}" fd-clone-repo \
    || abort "The clone failed; fix the error above and re-run 'fd-setup'."

step 5/6 "npm install in frickeldave.github.io"
(cd "${repo_dir}" && npm ci) || (cd "${repo_dir}" && npm install) \
    || abort "npm install failed in ${repo_dir}."

step 6/6 "Copilot CLI login"
case "$(fd_copilot_status)" in
    yes) echo "  already logged in." ;;
    no)
        if [ -t 0 ] && [ -t 1 ]; then
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
