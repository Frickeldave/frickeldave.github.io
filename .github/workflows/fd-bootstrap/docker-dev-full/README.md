# fd-dev-full

`fd-dev-full` erbt von `fd-dev-base` und ergänzt ausschließlich SSH
(`sshd`, optionaler Key-Login) sowie den Start-Entrypoint für die Remote-Dev-Maschinen.
Die Toolchain (Node, `gh`, Copilot CLI, Squad CLI inkl. `squad rc`, `kubectl`,
Playwright) bleibt im Basis-Image (siehe [`../../../../scripts/bootstrap/docker-dev-base/README.md`](../../../../scripts/bootstrap/docker-dev-base/README.md)).

- Standard-Tag: `ghcr.io/frickeldave/fd-dev-full:latest`
- Laufzeit-Nutzer: `appuser`; `sshd` läuft unprivilegiert auf Port `2222`, **nur wenn** ein Schlüssel vorliegt.
- Der öffentliche SSH-Schlüssel kommt aus `FD_SSH_PUBLIC_KEY` (kein Volume, kein Secret). Ist die
  Variable leer, startet kein `sshd`, es wird keine `authorized_keys` geschrieben und der Container
  bleibt per `sleep infinity` am Leben — der Zugang läuft dann ausschließlich über
  `kubectl exec -it fd-dev-<handle>-0 -c dev -- bash`. Das ist der aktuelle Stand für David Koenig:
  in `.squad/team.md` ist bewusst **kein** Schlüssel hinterlegt.
- Ein neues Image startet laufende Maschinen nicht neu (StatefulSet `OnDelete`); erst ein bewusster
  Pod-Neustart zieht es, wobei alle Container-Daten verloren gehen (`restart_machines`).
- Beim Start klont `fd-clone-repo` das Repository nach `FD_REPO_DIR`. Schlägt der Clone fehl
  (privates Repo), führt `fd-setup` durch die Anmeldung: `gh auth login`,
  `gh auth refresh -s read:project`, Git-Identität aus `gh api user`, Clone des Repositories,
  `npm ci` (Fallback `npm install`) und `copilot login`. Die Anmeldung bleibt bewusst manuell; es
  wird **keine** `.env`-Datei geschrieben. **Eine bewusst begrenzte Ausnahme:** Mit aktivem
  DeepSeek-Provider liegt der API-Key als Datei mit `0600` unter `~/.config/fd/` — außerhalb des
  Repositories, nicht im Image und nicht in der Prozessumgebung. Ohne Opt-in enthält die Maschine
  keine Secrets.
- `fd-setup` endet mit dem **optionalen** Schritt `7/7` „Optional: DeepSeek-Provider“. Der Schritt
  läuft nur nach ausdrücklicher Bestätigung bzw. mit `FD_SETUP_DEEPSEEK=1` (der Key kommt dann über
  stdin); der Key wird per `read -rs` abgefragt (kein Echo, kein Verlauf) und als
  `~/.config/fd/copilot-provider.key` mit `0600` in einem `0700`-Verzeichnis abgelegt, daneben
  `copilot-provider.env` mit `0600`. Danach prüft `fd-setup` die Konfiguration über den
  `provider`-Modus des Provider-Moduls. Der Schritt ist idempotent, überschreibt eine vorhandene
  Konfiguration nur nach ausdrücklichem `y` und erzeugt ohne TTY, bei Ablehnung oder mit `--help`
  keine Datei.
- `fd-setup --reset-provider` löscht Konfigurations- und Key-Datei, stellt den GitHub-Default wieder
  her und gibt den Widerrufshinweis aus. `$HOME` ist im Dev-Pod bewusst flüchtig (kein Volume); nach
  einem Pod- oder Image-Neustart muss der Key neu gesetzt werden.
- `fd-welcome` zeigt genau eine Provider-Zeile, exemplarisch
  `Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-flash` bzw.
  `Provider : GitHub Copilot (Standard)`; dieselbe Zeile liefert im Container
  `node /usr/local/lib/fd-dev/copilot-environment.mjs provider --line`. Die gemeinsame
  Statusfunktion gibt dafür nur `set`, `unset` oder `invalid-permissions` aus — keinen Key,
  keine Länge, kein Präfix. Details stehen in
  [Copilot-Provider (DeepSeek)](../../../../docs/17-dev-copilot-provider.md).
- Hilfsskripte im Image: `fd-setup` (geführtes Onboarding, idempotent), `fd-clone-repo`,
  `fd-welcome` (Login-Banner, nur interaktive Shells, ohne Netzwerkzugriff) und die gemeinsame
  Statusfunktion `/usr/local/lib/fd-dev/fd-status.sh` mit `copilot-environment.mjs` und
  `copilot-provider.mjs` (dieselbe Implementierung wie die Start-Flows). Das Provider-Modul wird als
  `/usr/local/lib/fd-dev/copilot-provider.mjs` mit `0644` kopiert; fehlt die `COPY`-Zeile, fällt der
  Provider-Status im Image fehl.
- `fd-setup` und die Start-Flows konfigurieren Shift+Enter entsprechend Copilots
  `/terminal-setup` und deaktivieren die TUI-Maus mit `copilot config mouse false`, soweit
  unterstützt. Vorhandene Einstellungen bleiben erhalten.
- VS Code Remote-SSH: Das Banner erscheint im integrierten Terminal (Terminal > New Terminal), nicht
  beim Verbinden. Der Hook in `~/.bashrc` gibt es nur in interaktiven Shells aus, einmal pro Terminal
  (`FD_WELCOME_SHOWN` = PID der Shell). Der Entrypoint legt
  `~/.vscode-server/data/Machine/settings.json` mit Defaults an, falls sie fehlt.
- Erreichbarkeit: `kubectl exec` (immer), SSH per `kubectl port-forward` (`2222:22`) oder per
  `ProxyCommand kubectl -n fd-infra exec -i fd-dev-<handle>-0 -- nc localhost 2222`, Squad RC per
  Port-Forward `3000:3000`. Alles nur mit `pods/exec`-Rechten.
- Änderungen hier erfordern einen Image-Neubau (automatisch im Workflow) und für laufende
  Maschinen einen bewussten Neustart (`restart_machines`, Datenverlust).

## Neustart: was verloren geht und wie es weitergeht

Ein Dev-Container hat bewusst **kein Volume**. Wird er wegen Speichermangels beendet
(`OOMKilled`, `exitCode 137`), startet Kubernetes ihn im selben Pod neu — das Container-Dateisystem
ist danach leer. Dasselbe gilt für jeden bewussten Neustart über `restart_machines` oder
`kubectl delete pod`.

### Was verloren geht

- `~/.config/gh` — der `gh`-Login inklusive der Berechtigung `read:project`
- `~/.copilot` — Copilot-Login und Provider-Konfiguration
- `~/.ssh` — Schlüssel und `known_hosts`
- `.gitconfig` — Git-Identität und globale Einstellungen
- der Checkout `~/frickeldave.github.io`
- **alle Worktrees** samt ungepushtem Arbeitsstand
- tmux-Sessions
- der VS-Code-Server-Zustand unter `~/.vscode-server`

Ein laufender Start-Flow ist damit ebenfalls beendet.

### Erkennungssignale

`fd-status.sh` liefert die Werte für das Banner von `fd-welcome`; nach einem Neustart zeigen sie:

- `Container-Uptime:` — Alter der Ready-Marke `~/.fd-ready` in Sekunden. Der Entrypoint legt die
  Marke bei jedem Containerstart neu an, ihr mtime ist damit der verlässlichste Startzeitpunkt.
  Ist die Marke nicht lesbar, dient die Laufzeit von PID 1 (`ps -p 1 -o etimes=`) als Fallback;
  ist auch die nicht ermittelbar, steht dort `unknown`. Ein kleiner Wert direkt nach dem Verbinden
  ist der deutlichste Hinweis auf einen Neustart.
- `Memory-Limit:` — Bytes aus `/sys/fs/cgroup/memory.max` (cgroup v2), im Banner zusätzlich als
  GiB bzw. MiB. Fehlt die Datei, liest `fd_memory_limit` als Fallback den cgroup-v1-Wert aus
  `/sys/fs/cgroup/memory/memory.limit_in_bytes`; `max`, „unlimited“ oder ein nicht lesbarer Wert
  ergeben `unknown`.
- `Restart: restart-suspected` — die Uptime liegt unter 600 Sekunden, der Container wurde also
  vermutlich gerade neu gestartet (oder der Pod ist frisch angelegt); `Restart: ok` — die Uptime
  ist mindestens 600 Sekunden; `Restart: unknown` — die Uptime ließ sich nicht ermitteln.
- `WARN: container uptime < 600 s — restart suspected` — Warnzeile, wenn die Uptime unter
  600 Sekunden liegt.

### Recovery mit `fd-setup`

`fd-setup` ist im Container vorhanden und stellt `gh`-Login, Checkout und Arbeitsumgebung wieder
her. Prüfbar ist das anschließend über:

```bash
gh auth status
git -C "$FD_REPO_DIR" rev-parse --is-inside-work-tree
```

`gh auth status` endet mit Exit 0, `rev-parse` gibt `true` aus.

### Flow neu starten, nicht fortsetzen

Einen unterbrochenen Start-Flow **neu starten, nicht fortsetzen**. Der Entrypoint klont das
Repository nur im Hintergrund (`timeout 120 … || true`, Log unter `~/.fd-clone.log`); die
Credentials kommen dadurch nicht zurück. Erst `fd-setup` stellt die Anmeldung wieder her, danach
beginnt der Start-Flow von vorn.

### Neustart auslösen

Ein Neustart erfolgt bewusst über `restart_machines` im Workflow `fd-bootstrap` (`all` oder eine
kommagetrennte Liste von Handles bzw. Maschinennamen; Maschinen mit aktiver SSH-Sitzung werden
übersprungen, außer `force_restart=true`) oder direkt über `kubectl delete pod`. Das StatefulSet
nutzt `updateStrategy: OnDelete`: Ein geändertes Pod-Template — etwa ein neues Image oder neue
Ressourcen — startet eine laufende Maschine **nie** automatisch neu.

## Ressourcen der Dev-Container

CPU- und RAM-Werte der gespawnten Dev-Container sind beim Start über `workflow_dispatch`-Parameter
des Workflows `fd-bootstrap` setzbar:

| Input | Default | Bedeutung |
| --- | --- | --- |
| `dev_cpu_request` | `100m` | CPU-Request je Dev-Container |
| `dev_memory_request` | `2Gi` | Memory-Request je Dev-Container |
| `dev_cpu_limit` | `4` | CPU-Limit je Dev-Container |
| `dev_memory_limit` | `16Gi` | Memory-Limit je Dev-Container |

Eine leere Eingabe bedeutet Default. Die Werte müssen dem Kubernetes-Quantity-Format entsprechen;
ist ein Wert ungültig, bricht der Workflow vor dem `kubectl apply` ab. Ein geänderter Wert wirkt
erst nach einem bewussten Neustart der Maschine (`updateStrategy: OnDelete`, siehe oben).

Die Felder im Dispatch-Dialog sind vorbelegt: `build_image=true`,
`image=ghcr.io/frickeldave/fd-dev-full:latest`, `restart_machines=frickeldave` (die eigene
Maschine) und `force_restart=true`; die Ressourcen-Parameter entsprechen den Defaults der Tabelle.
Ein leer gelassenes `restart_machines` bedeutet **kein** Neustart. Jeder Dispatch mit diesen
Defaults baut das Image neu und startet die eigene Maschine — er kostet damit `gh`-/Copilot-Login,
den Checkout und alle Worktrees, danach läuft `fd-setup` (siehe „Neustart: was verloren geht und
wie es weitergeht“).

## Build

Der Workflow `fd-bootstrap.yml` baut das Image per Kaniko-Job (Kontext: Repository-Root), bei
Änderung in diesem Verzeichnis, an `scripts/copilot-environment.mjs`, `scripts/platform-shared.mjs`
oder `scripts/copilot-provider.mjs` oder per `build_image`. Die Felder `build_image` (`true`) und
`image` (`ghcr.io/frickeldave/fd-dev-full:latest`) sind im Dispatch-Dialog vorbelegt. Lokal:

```bash
docker build \
  -f .github/workflows/fd-bootstrap/docker-dev-full/Dockerfile \
  --build-arg DEV_BASE_IMAGE=ghcr.io/frickeldave/fd-dev-base:latest \
  -t ghcr.io/frickeldave/fd-dev-full:latest \
  .
```
