#!/bin/sh
# Prints the number of live SSH sessions of a dev machine. Streamed into the
# container via `kubectl exec -i ... -- sh -s`, so it only uses POSIX sh and
# /proc (no ps/who needed). sshd renames each session process to
# "sshd: <user>@pts/N" (or "@notty" for exec/port-forward only sessions);
# the listener and pre-auth processes carry no "@" and are not counted.
# A machine without an SSH key runs no sshd at all, so the count is 0.
# PROC_DIR is overridable for tests.
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
