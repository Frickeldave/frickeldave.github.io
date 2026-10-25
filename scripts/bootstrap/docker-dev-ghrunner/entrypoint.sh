#!/usr/bin/env bash
set -euo pipefail

configure_in_cluster_kubeconfig() {
  local service_account_dir=/var/run/secrets/kubernetes.io/serviceaccount
  local kubeconfig_path="${HOME}/.kube/config"

  if [[ ! -r "${service_account_dir}/token" || ! -r "${service_account_dir}/ca.crt" ]]; then
    return 0
  fi

  mkdir -p "${HOME}/.kube"
  cat >"${kubeconfig_path}" <<EOF
apiVersion: v1
kind: Config
clusters:
- name: in-cluster
  cluster:
    certificate-authority: ${service_account_dir}/ca.crt
    server: https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT_HTTPS:-443}
users:
- name: runner
  user:
    tokenFile: ${service_account_dir}/token
contexts:
- name: runner
  context:
    cluster: in-cluster
    namespace: $(<"${service_account_dir}/namespace")
    user: runner
current-context: runner
EOF
  chmod 600 "${kubeconfig_path}"
  export KUBECONFIG="${kubeconfig_path}"
}

cleanup() {
  if [[ -n "${RUNNER_TOKEN:-}" ]]; then
    echo "Removing runner registration for ${RUNNER_NAME:-unknown} (${RUNNER_SCOPE:-repo})..."
    ./config.sh remove --token "${RUNNER_TOKEN}" || true
  fi
}

# BEGIN runner-name resolution
# Append the pod name so multiple Deployment replicas each register under a
# unique runner identity instead of replacing one another (--replace below).
# The Deployment already names its pods after the runner prefix, so prepend the
# prefix only when the identity does not carry it yet. Unconditional prepending
# produced double-prefixed names such as
# github-actions-runner-github-actions-runner-55795b4dcb-2wjn6.
resolve_runner_name() {
  runner_prefix="${RUNNER_NAME_PREFIX:-github-actions-runner}"
  runner_identity="${POD_NAME:-$(hostname)}"

  case "${runner_identity}" in
    "${runner_prefix}"*) printf '%s\n' "${runner_identity}" ;;
    *) printf '%s\n' "${runner_prefix}-${runner_identity}" ;;
  esac
}
# END runner-name resolution

if [[ -n "${REPO_URL:-}" || -n "${RUNNER_TOKEN:-}" ]]; then
  REPO_URL="${REPO_URL:?REPO_URL is required for runner mode}"
  RUNNER_TOKEN="${RUNNER_TOKEN:?RUNNER_TOKEN is required for runner mode}"
  RUNNER_NAME="$(resolve_runner_name)"
  RUNNER_LABELS="${RUNNER_LABELS:-}"
  RUNNER_SCOPE="${RUNNER_SCOPE:-repo}"

  configure_in_cluster_kubeconfig

  trap cleanup EXIT SIGTERM SIGINT

  ./config.sh \
    --url "${REPO_URL}" \
    --token "${RUNNER_TOKEN}" \
    --name "${RUNNER_NAME}" \
    --labels "${RUNNER_LABELS}" \
    --unattended \
    --replace

  exec ./run.sh
fi

exec "$@"
