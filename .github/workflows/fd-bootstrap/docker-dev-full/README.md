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
- `fd-status` und `fd-welcome` zeigen genau eine Provider-Zeile, exemplarisch
  `Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-flash` bzw.
  `Provider : GitHub Copilot (Standard)`. Die gemeinsame Statusfunktion gibt dafür nur `set`,
  `unset` oder `invalid-permissions` aus — keinen Key, keine Länge, kein Präfix. Details stehen in
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

## Build

Der Workflow `fd-bootstrap.yml` baut das Image per Kaniko-Job (Kontext: Repository-Root), bei
Änderung in diesem Verzeichnis, an `scripts/copilot-environment.mjs`, `scripts/platform-shared.mjs`
oder `scripts/copilot-provider.mjs` oder per `build_image`. Lokal:

```bash
docker build \
  -f .github/workflows/fd-bootstrap/docker-dev-full/Dockerfile \
  --build-arg DEV_BASE_IMAGE=ghcr.io/frickeldave/fd-dev-base:latest \
  -t ghcr.io/frickeldave/fd-dev-full:latest \
  .
```
