#!/usr/bin/env bash
# Deliberately restarts the selected dev machines by deleting their pod; the
# StatefulSet recreates it from the current spec (imagePullPolicy: Always pulls
# the newest image). ALL DATA IN THE CONTAINER IS LOST. Machines with a live SSH
# session are skipped unless FORCE_RESTART=true.
#
# Env: NAMESPACE, MACHINES_FILE (one machine name per line), FORCE_RESTART,
#      SESSIONS_SCRIPT (path of active-sessions.sh), KUBECTL_REQUEST_TIMEOUT.
set -euo pipefail

namespace="${NAMESPACE:?NAMESPACE is required}"
machines_file="${MACHINES_FILE:?MACHINES_FILE is required}"
sessions_script="${SESSIONS_SCRIPT:?SESSIONS_SCRIPT is required}"
force="${FORCE_RESTART:-false}"
timeout="${KUBECTL_REQUEST_TIMEOUT:-60s}"

restarted=()
skipped=()

while read -r machine; do
  [ -n "${machine}" ] || continue
  pod="${machine}-0"

  if ! kubectl get pod "${pod}" -n "${namespace}" --request-timeout="${timeout}" >/dev/null 2>&1; then
    echo "${machine}: pod does not exist yet; nothing to restart."
    continue
  fi

  if [ "${force}" = "true" ]; then
    echo "${machine}: force_restart=true, skipping the session check."
  else
    # An unreadable session count is treated as "busy" so data is never lost by accident.
    if sessions="$(kubectl exec -i "${pod}" -n "${namespace}" -c dev --request-timeout="${timeout}" -- sh -s < "${sessions_script}" 2>/dev/null)" &&
      [[ "${sessions}" =~ ^[0-9]+$ ]]; then
      if [ "${sessions}" -gt 0 ]; then
        echo "::warning::${machine}: ${sessions} active SSH session(s); skipped. Use force_restart to override (data is lost)."
        skipped+=("${machine}")
        continue
      fi
    else
      echo "::warning::${machine}: could not determine active SSH sessions; skipped. Use force_restart to override (data is lost)."
      skipped+=("${machine}")
      continue
    fi
  fi

  echo "${machine}: deleting pod ${pod} (container data is lost)."
  kubectl delete pod "${pod}" -n "${namespace}" --request-timeout="${timeout}" --ignore-not-found
  restarted+=("${machine}")
done < "${machines_file}"

echo "Restarted: ${restarted[*]:-none}"
echo "Skipped (active session): ${skipped[*]:-none}"
