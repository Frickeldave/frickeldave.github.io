#!/bin/sh
# Gibt die Anzahl aktiver SSH-Sitzungen einer Dev-Maschine aus. Wird per
# `kubectl exec -i ... -- sh -s` in den Container gestreamt, nutzt daher nur POSIX sh und
# /proc (kein ps/who nötig). sshd benennt jeden Sitzungsprozess um zu
# „sshd: <user>@pts/N" (bzw. „@notty" für reine exec-/Port-Forward-Sitzungen);
# Listener und Pre-Auth-Prozesse tragen kein „@" und werden nicht gezählt.
# Eine Maschine ohne SSH-Schlüssel startet kein sshd, die Anzahl ist dann 0.
# PROC_DIR ist für Tests überschreibbar.
proc_dir="${PROC_DIR:-/proc}"
count=0
for cmdline in "$proc_dir"/[0-9]*/cmdline; do
  [ -r "$cmdline" ] || continue
  title="$(tr '\0' ' ' < "$cmdline" 2>/dev/null)" || continue
  case "$title" in
    "sshd: "*@*) count=$((count + 1)) ;;
  esac
done
echo "$count"
