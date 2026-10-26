#!/usr/bin/env bash
# Listet laufende Dev-Maschinen, die noch ein älteres Image/Spec nutzen, weil nichts
# sie automatisch neu startet (StatefulSet-UpdateStrategy OnDelete). Eine Maschine ist
# veraltet, wenn die Pod-Revision von der Update-Revision des StatefulSets abweicht oder
# ein neues Image gebaut wurde (gleicher Tag, die Revision ändert sich also nicht).
#
# Env: NAMESPACE, MACHINES_FILE, IMAGE_BUILT (true/false), KUBECTL_REQUEST_TIMEOUT,
# GITHUB_STEP_SUMMARY (optional).
set -euo pipefail

namespace="${NAMESPACE:?NAMESPACE is required}"
machines_file="${MACHINES_FILE:?MACHINES_FILE is required}"
built="${IMAGE_BUILT:-false}"
timeout="${KUBECTL_REQUEST_TIMEOUT:-60s}"

outdated=()
while read -r machine; do
  [ -n "${machine}" ] || continue
  pod_revision="$(kubectl get pod "${machine}-0" -n "${namespace}" --request-timeout="${timeout}" \
    -o jsonpath='{.metadata.labels.controller-revision-hash}' 2>/dev/null || true)"
  [ -n "${pod_revision}" ] || continue
  update_revision="$(kubectl get statefulset "${machine}" -n "${namespace}" --request-timeout="${timeout}" \
    -o jsonpath='{.status.updateRevision}' 2>/dev/null || true)"
  if [ "${built}" = "true" ] || { [ -n "${update_revision}" ] && [ "${pod_revision}" != "${update_revision}" ]; }; then
    outdated+=("${machine}")
  fi
done < "${machines_file}"

if [ "${#outdated[@]}" -eq 0 ]; then
  echo "All running dev machines are up to date."
  exit 0
fi

message="Running dev machines NOT restarted (still on the old image/spec): ${outdated[*]}
Restart deliberately (ALL DATA IN THE CONTAINER IS LOST: gh/copilot login, worktrees, unpushed work):
  - run fd-bootstrap with restart_machines=all or a comma-separated list of handles/machine names, or
  - kubectl -n ${namespace} delete pod <machine>-0 (e.g. ${outdated[0]}-0)"
echo "::notice::${message//$'\n'/%0A}"
echo "${message}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Dev machines with an outdated image/spec"
    echo
    echo "These running machines were **not** restarted:"
    for machine in "${outdated[@]}"; do echo "- \`${machine}\`"; done
    echo
    echo "Restart deliberately via the \`restart_machines\` input (optionally \`force_restart\`) or \`kubectl -n ${namespace} delete pod <machine>-0\`. **All data in the container is lost** (gh/copilot login, worktrees, unpushed work)."
  } >> "${GITHUB_STEP_SUMMARY}"
fi
