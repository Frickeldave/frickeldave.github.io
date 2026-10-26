#!/usr/bin/env bash
# Startet die ausgewählten Dev-Maschinen bewusst neu, indem ihr Pod gelöscht wird; das
# StatefulSet erzeugt ihn aus dem aktuellen Spec neu (imagePullPolicy: Always zieht
# das neueste Image). ALLE DATEN IM CONTAINER GEHEN VERLOREN. Maschinen mit aktiver
# SSH-Sitzung werden übersprungen, außer FORCE_RESTART=true.
#
# Env: NAMESPACE, MACHINES_FILE (ein Maschinenname pro Zeile), FORCE_RESTART,
# SESSIONS_SCRIPT (Pfad von active-sessions.sh), KUBECTL_REQUEST_TIMEOUT.
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
    # Eine unlesbare Sitzungszahl gilt als „beschäftigt", damit nie versehentlich Daten verloren gehen.
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
