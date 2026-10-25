# Kubernetes-Runner-Bootstrap

Dieses Paket bootstrappt den GitHub-Actions-Self-hosted-Runner in Kubernetes: Namespace, Images,
Secrets, RBAC und das Runner-Deployment. Es ist eigenständig und projektneutral — **jeder
projektspezifische Wert steht in [`bootstrap.json`](bootstrap.json)**. Skripte, Templates und
Dokumentation enthalten keine Projekt-Literale.

## In ein anderes Projekt übernehmen

1. `scripts/bootstrap/` in das Ziel-Repository kopieren.
2. `scripts/bootstrap/bootstrap.json` anpassen (Namespace, Repository, Image-Referenzen, Labels).
3. Bootstrap ausführen:

   ```powershell
   $env:GITHUB_PAT = "ghp_xxxxx"
   $env:GITHUB_USERNAME = "<github-username>"
   .\scripts\bootstrap\bootstrap.ps1
   ```

Mehr ist nicht nötig: `bootstrap.json` ist die einzige Quelle für projektspezifische Werte. Für den
Ziel-Namespace gibt es keinen Built-in-Default — fehlt er, bricht das Skript mit einer klaren
Meldung ab, statt einen Namen zu erfinden.

## Layout

```text
scripts/bootstrap/
├── README.md
├── bootstrap.json
├── bootstrap.md
├── bootstrap.mjs
├── bootstrap.ps1
├── bootstrap.test.mjs
├── docker-dev-base/
│   ├── Dockerfile
│   ├── README.md
│   └── entrypoint.sh
├── docker-dev-ghrunner/
│   ├── Dockerfile
│   ├── README.md
│   └── entrypoint.sh
├── docker-dev-kaniko/
│   ├── Dockerfile
│   └── README.md
└── k8s/
    ├── namespace.yaml
    ├── rbac.yaml
    ├── runner-deployment.yaml
    └── runner-secrets.yaml
```

Weiterführende Dokumente: [`bootstrap.md`](bootstrap.md) (Runner-only-Betrieb),
[`docker-dev-base/README.md`](docker-dev-base/README.md),
[`docker-dev-ghrunner/README.md`](docker-dev-ghrunner/README.md),
[`docker-dev-kaniko/README.md`](docker-dev-kaniko/README.md).

Tests: `npm run test:bootstrap` (eingebauter `node --test`-Runner, keine zusätzliche
Test-Dependency).

## Zielwerte und ihre Quelle

| Element                                    | Quelle in `bootstrap.json`                            |
| ------------------------------------------ | ----------------------------------------------------- |
| GitHub-Repository (`REPO_URL`)             | `githubRunnerOrg` + `githubRunnerRepo`                |
| Runner-Scope                               | `runnerScope` (Default `repo`)                        |
| Kubernetes-Namespace                       | `namespace` (Pflicht, kein Built-in-Default)          |
| Kubeconfig                                 | `kubeconfig` (optional)                               |
| Replicas                                   | fest `2` im Deployment-Template                       |
| Runner-Label                               | `runnerLabels` (Pflicht)                              |
| Label `app.kubernetes.io/part-of`          | `partOf`, Fallback `githubRunnerRepo`                 |
| Runner-Image                               | `ghRunnerImage` (Pflicht bei jedem Lauf)              |
| Dev-Base-Image                             | `devBaseImage` (Pflicht, außer `SKIP_IMAGE_BUILD`)    |
| Kaniko-Image                               | `kanikoImage` (Pflicht, außer `SKIP_IMAGE_BUILD`)     |
| Images bauen/pushen überspringen           | `skipImageBuild`                                      |
| GHCR-Benutzer                              | `githubUsername`                                      |

Ein anderer Projektkontext setzt einfach andere Werte in diese Datei; an Skripten und Templates ist
nichts zu ändern.

## Images

Alle drei Image-Referenzen kommen ausschließlich aus der Konfiguration (Reihenfolge:
Umgebungsvariable > `bootstrap.json` > Fail-fast). Es gibt **keine** eingebauten Image-Namen.

### Dev-Base-Image (`devBaseImage`)

- Dockerfile: `scripts/bootstrap/docker-dev-base/Dockerfile`
- Zweck: wiederverwendbares Ubuntu-24.04-Entwicklungs-Basisimage
- Enthält Node.js 24, GitHub CLI, GitHub Copilot CLI, Squad CLI, Playwright 1.63.0 mit
  vorinstalliertem Chromium/Firefox/WebKit, Playwright-Systemabhängigkeiten, `kubectl` und das
  allgemeine CLI-Tooling (`git`, `jq`, `rg`, `build-essential`, Python 3 samt `python`-Kommando und
  Pillow, `curl`, `ca-certificates`, `locales`, Archiv-/Prozess-Tools usw.)
- Finaler Laufzeit-Nutzer: `appuser`
- Enthält **nicht** die GitHub-Actions-Runner-Binary

### Runner-Image (`ghRunnerImage`)

- Dockerfile: `scripts/bootstrap/docker-dev-ghrunner/Dockerfile`
- Zweck: GitHub-Actions-Runner-Image auf Basis des Dev-Base-Images
- Ergänzt die gepinnte GitHub-Runner-Binary (`RUNNER_VERSION=2.337.0`), den gepinnten `crane`-Client
  (`v0.22.1`) und die Logik des Registrierungs-Entrypoints
- Finaler Laufzeit-Nutzer: `appuser`
- Der Entrypoint setzt `RUNNER_NAME` aus `RUNNER_NAME_PREFIX` und `POD_NAME` und stellt das Präfix
  (Standard `github-actions-runner`) nur voran, wenn der Pod-Name es nicht schon enthält, damit beide
  Replicas unter unterschiedlichen, nicht doppelt präfigierten Runner-Identitäten registriert werden

### Kaniko-Image (`kanikoImage`)

- Dockerfile: `scripts/bootstrap/docker-dev-kaniko/Dockerfile`
- Zweck: projekteigener Kaniko-Executor für Build-Jobs aus dem Cluster
- Gebaut aus `ubuntu:24.04`, nicht aus `gcr.io/kaniko-project/executor` oder einem anderen
  vorgebauten Kaniko-Image
- Baut den Executor aus dem offiziellen Kaniko-`v1.23.2`-Quellcode am Commit
  `1ae9a8416c14418625de90c1115052c0a6ebee07` und verifiziert die Herkunft vor dem Kompilieren
- Finaler Laufzeit-Nutzer: numerisch `1000:1000`; Standardbefehl: `sleep infinity`
- Wird von `scripts/bootstrap/bootstrap.mjs` gebaut und gepusht, aber vom Runner-Deployment
  **nicht** referenziert. Ein künftiger Anwendungs-Deploy-Workflow startet daraus Wegwerf-Jobs;
  deshalb bleiben Image, Build-Steps und RBAC erhalten

## Kubernetes-Manifeste

Die Manifest-Templates sind zur besseren Reviewbarkeit als einfaches YAML committet:

- `scripts/bootstrap/k8s/namespace.yaml` — Namespace-Erstellung (Template mit `__NAMESPACE__`)
- `scripts/bootstrap/k8s/runner-secrets.yaml` — Template mit beiden Secrets
  (`github-runner-registration` und `ghcr-pull-secret`)
- `scripts/bootstrap/k8s/runner-deployment.yaml` — Template für das Runner-Deployment (2 Replicas)
- `scripts/bootstrap/k8s/rbac.yaml` — Template für die Kaniko-Builder-Role und das RoleBinding des
  Runners

Platzhalter-Konvention: Jeder zur Laufzeit ersetzte Wert verwendet `__NAME__`-Token. `bootstrap.mjs`
ersetzt diese Platzhalter im Speicher unmittelbar vor `kubectl apply`. Echte Secrets werden nie
committet.

| Platzhalter     | Template               | Quelle                                                                 |
| --------------- | ---------------------- | ---------------------------------------------------------------------- |
| `__NAMESPACE__` | alle vier              | `namespace` (oder `-n/--namespace`)                                    |
| `__PART_OF__`   | `runner-deployment`    | `partOf`, Fallback `githubRunnerRepo`; muss ein valider Label-Wert sein |
| `__RUNNER_IMAGE__` | `runner-deployment` | `ghRunnerImage`                                                        |
| `__REPO_URL__`  | `runner-secrets`       | abgeleitet aus `githubRunnerOrg`/`githubRunnerRepo`                    |
| `__RUNNER_TOKEN__` | `runner-secrets`    | frischer Registration-Token pro Lauf (GitHub-API)                      |
| `__RUNNER_NAME__` | `runner-secrets`     | `runnerName` (Fallback `github-actions-runner-<namespace>`)            |
| `__RUNNER_SCOPE__` | `runner-secrets`    | `runnerScope`                                                          |
| `__RUNNER_LABELS__` | `runner-secrets`   | `runnerLabels`                                                         |
| `__DOCKERCONFIGJSON__` | `runner-secrets` | `githubUsername` + `GITHUB_PAT`                                        |

## Runner-Build-Architektur

Image-Builds finden **nicht** im Runner-Pod statt. Ein künftiger Anwendungs-Deploy-Workflow soll das
Kaniko-Image als `batch/v1`-Job im konfigurierten Runner-Namespace starten, auf den Job warten,
dessen Logs ins Actions-Log ausgeben und ihn wieder löschen. Bis dieser Workflow existiert, baut das
Bootstrap nur die drei Images.

Kaniko läuft **als root in diesem Job** (`runAsUser: 0`, `runAsGroup: 0`). Es extrahiert das
Base-Image-Dateisystem direkt nach `/` seines eigenen Containers und benötigt dort uneingeschränkten
`chown`-/Schreibzugriff; als Nicht-Root-Subprozess des Runner-Containers schlägt es mit
`permission denied` auf `/bin` und `chown /kaniko/Dockerfile: operation not permitted` fehl, und als
root im Runner würde es das eigene `/bin` und `/usr` des Runners überschreiben. Root in einem
Wegwerf-Build-Pod ist nur Prozessisolation: Der Job hat kein `privileged: true`, keine zusätzlichen
Capabilities, keinen hostPath, kein Host-Netzwerk, keine Host-PID, und der Pod wird nach jedem Build
entfernt.

Der Runner-Pod behält einen schreibgeschützten `ghcr-pull-secret`-Mount unter
`/home/appuser/.registry-docker`, auf den `DOCKER_CONFIG` zeigt. Das ist **kein** Überbleibsel: Ein
künftiger Anwendungs-Deploy-Workflow führt `crane manifest` im Runner-Container aus, um zu
entscheiden, ob ein versioniertes Image bereits in der Registry existiert, und diese Abfrage
benötigt Registry-Authentifizierung. Der Runner-Pod nutzt UID/GID 1001, `RuntimeDefault`-Seccomp und
entzogene Linux-Capabilities und hat keinen Docker-Socket, keinen privilegierten Container, keinen
Host-Pfad, kein Host-Netzwerk und keine Host-PID/IPC.

## Erforderliche Berechtigungen des Runner-ServiceAccounts

`scripts/bootstrap/k8s/rbac.yaml` ist das sichtbare RBAC-Template zum Review. In Step 7 rendert
`bootstrap.mjs` es mit dem gewählten Runner-Namespace und wendet die resultierenden Roles und
RoleBindings an.

Die generierten Berechtigungen sind auf die Kaniko-Baufähigkeit beschränkt:

- `kaniko-builder`-Role und -RoleBinding im gewählten Runner-Namespace (dem `namespace`-Wert aus
  `bootstrap.json`), die dem Runner-ServiceAccount `<namespace>:default` erlauben, Kaniko-Jobs zu
  erstellen, zu beobachten und zu löschen.

Die Role gewährt `jobs.batch`: `create`, `get`, `list`, `watch`, `delete`; `pods` und `pods/log`:
`get`, `list`; sowie `secrets`: `create`, `update`, `get`, `delete` (für die kurzlebigen
Git-Token-Secrets der Build-Jobs). Kubernetes unterstützt keine Einschränkung von `create` über
`resourceNames`; die Beschränkung erfolgt daher über den Namespace und den ServiceAccount.

Zwei Objekte aus dem ursprünglichen App-Deploy-Modell wurden bewusst entfernt: ein RBAC-Reconciler
(verwaltete die Deployer-Role eines Deployment-Workflows) und ein Machine-Manager (StatefulSets für
per-Developer-Dev-Machines). Beide werden von einem Kaniko-Build-Job nicht benötigt.

`bootstrap.mjs` rendert zuerst das Namespace-Manifest, dann diese Namespace-Roles und RoleBindings
und rendert und wendet schließlich die Runner-Secrets und das Deployment im gewählten Namespace an
(der `namespace`-Wert aus `bootstrap.json`). Die Kubernetes-Operationen sind idempotent.

## Konfigurationsdatei

`scripts/bootstrap/bootstrap.json` ist die einzige Quelle für projektspezifische Werte. Sie enthält
bewusst **keine** Secrets. Beispielform:

| JSON key           | Purpose                                                                 | Beispielwert                            |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------------- |
| `namespace`        | Standard-Ziel-Namespace (Pflicht, kein Built-in-Default).                | `<namespace>`                           |
| `kubeconfig`       | Kubeconfig für alle kubectl-Aufrufe (optional).                          | `<path-to-kubeconfig>`                  |
| `devBaseImage`     | In Step 2 gebauter/gepushter Image-Tag, genutzt als Parent in Step 3.    | `<registry>/<dev-base-image>:<tag>`     |
| `ghRunnerImage`    | In Steps 3/5 gebauter/gepushter und in Step 9 deployter Image-Tag.       | `<registry>/<runner-image>:<tag>`       |
| `kanikoImage`      | In Step 4 gebauter Image-Tag, für künftige Build-Jobs.                   | `<registry>/<kaniko-image>:<tag>`       |
| `skipImageBuild`   | Überspringt alle drei lokalen Builds, den Login und alle drei Pushes.    | `false`                                 |
| `githubUsername`   | GitHub-Username für Registry-Auth und Pull-Secret-Daten.                 | `<github-username>`                     |
| `githubRunnerOrg`  | GitHub-Owner zur Ableitung von `REPO_URL` (Pflicht).                     | `<owner>`                               |
| `githubRunnerRepo` | GitHub-Repository für `REPO_URL` und Fallback für `partOf` (Pflicht).   | `<repo>`                                |
| `runnerName`       | Runner-Namenspräfix, im Secret gespeichert.                             | `github-actions-runner`                 |
| `runnerLabels`     | Kommagetrennte Runner-Labels (Pflicht).                                  | `<label>`                               |
| `runnerScope`      | Kompatibilitätswert, im Secret gespeichert.                              | `repo`                                  |
| `partOf`           | Wert für `app.kubernetes.io/part-of` (optional, Fallback Repo-Name).     | `<app-name>`                            |

`GITHUB_PAT` wird **nie** aus dieser JSON-Datei gelesen. Als Defense-in-Depth-Sicherheitsprüfung
verweigert das Skript die Ausführung, wenn die Konfigurationsdatei einen PAT-ähnlichen
GitHub-Schlüssel wie `githubPat`, `github_pat` oder Ähnliches enthält.

## Umgebungsvariablen

| Variable             | Required                         | Purpose                                                                                                                    |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_PAT`         | Ja                               | Klassischer PAT für `docker login`, das gerenderte Registry-Pull-Secret und den Registration-Token-Aufruf                   |
| `GITHUB_USERNAME`    | Ja                               | GitHub-Username, gepaart mit `GITHUB_PAT` für Registry-Auth und Pull-Secret                                                |
| `KUBECONFIG`         | Nein                             | Kubeconfig für alle kubectl-Aufrufe; wird von `-k` / `--kubeconfig` und vom `kubeconfig`-Schlüssel überstimmt               |
| `DEV_BASE_IMAGE`     | Nein, außer `SKIP_IMAGE_BUILD=true` | Überschreibt `devBaseImage`                                                                                              |
| `GH_RUNNER_IMAGE`    | Ja (jeder Lauf)                  | Überschreibt `ghRunnerImage`; das Deployment referenziert es immer                                                         |
| `KANIKO_IMAGE`       | Nein, außer `SKIP_IMAGE_BUILD=true` | Überschreibt `kanikoImage`                                                                                              |
| `SKIP_IMAGE_BUILD`   | Nein                             | Bei `true` werden alle drei Image-Builds, der Login und alle drei Pushes übersprungen                                      |
| `GITHUB_RUNNER_ORG`  | Ja, wenn nicht in der Config     | Überschreibt `githubRunnerOrg`                                                                                             |
| `GITHUB_RUNNER_REPO` | Ja, wenn nicht in der Config     | Überschreibt `githubRunnerRepo`                                                                                            |
| `RUNNER_NAME`        | Nein                             | Überschreibt das Präfix des Runner-Namens (Fallback `github-actions-runner-<namespace>`); jeder Pod hängt seinen Pod-Namen an |
| `RUNNER_LABELS`      | Ja, wenn nicht in der Config     | Überschreibt `runnerLabels`                                                                                                |
| `RUNNER_SCOPE`       | Nein                             | Überschreibt den Kompatibilitäts-Scope-Wert (Default `repo`)                                                               |

### Scope-Anforderungen für `GITHUB_PAT`

Verwende einen **klassischen** Personal Access Token. Verwende hier **keinen** Fine-grained-PAT oder
GitHub-App-Token.

Erstelle ihn über:

1. GitHub → Settings
2. Developer settings
3. Personal access tokens
4. Tokens (classic)
5. Generate new token (classic)
6. Aktiviere diese Scopes:
   - `repo`
   - `read:packages`
   - `write:packages`
7. Erzwingt die Organisation SSO, autorisiere den Token nach der Erstellung für SSO

Fehlt `GITHUB_PAT` und das Skript hat ein interaktives TTY, fragt `bootstrap.mjs` danach mit
maskierter Eingabe, statt den Token auszugeben.

## Kubernetes-Kontext auswählen

Ohne weitere Angabe nutzt das Bootstrap den aktuellen kubectl-Kontext des Rechners. Für Cluster, bei
denen das nicht gewünscht ist, kennt das Skript einen expliziten Kubeconfig-Pfad:

```text
-k, --kubeconfig <path>
```

Rangfolge: `-k` / `--kubeconfig` > `KUBECONFIG` > `kubeconfig` in `bootstrap.json` > aktueller
kubectl-Kontext.

Ist ein Pfad aufgelöst, erhält **jeder** kubectl-Aufruf des Skripts `--kubeconfig <path>`
(`cluster-info`, `apply`, `rollout restart`, `rollout status`). Existiert die Datei nicht, bricht
Step 1 sofort mit einer klaren Meldung ab, bevor irgendetwas angewendet wird. Step 1 gibt außerdem
den aufgelösten Kontext, den Clusternamen und die Server-Version aus, damit der Operator vor dem
ersten `kubectl apply` sieht, welcher Cluster getroffen wird.

## Bootstrap-Ablauf

Normale Verwendung (Windows-Operator):

```powershell
$env:GITHUB_PAT = "ghp_xxxxx"
$env:GITHUB_USERNAME = "<github-username>"
# Namespace, Repository und Images kommen aus scripts/bootstrap/bootstrap.json
.\scripts\bootstrap\bootstrap.ps1 -Kubeconfig <path-to-kubeconfig>
```

`-Namespace <namespace>` überschreibt den konfigurierten Wert für einen einzelnen Lauf.

Direkt mit dem Node-Skript, ohne PowerShell-Wrapper:

```bash
export GITHUB_PAT=ghp_xxxxx
export GITHUB_USERNAME=<github-username>
node scripts/bootstrap/bootstrap.mjs --kubeconfig <path-to-kubeconfig>
```

Alternativ über npm:

```powershell
npm run bootstrap -- --kubeconfig <path-to-kubeconfig>
```

Das Node-Bootstrap-Skript führt diese sichtbaren Schritte der Reihe nach aus:

1. Voraussetzungsprüfungen
   - Existenz der aufgelösten Kubeconfig (bei konfiguriertem Pfad)
   - Verfügbarkeit der Docker-CLI und Erreichbarkeit des Docker-Daemons (beides übersprungen bei
     `SKIP_IMAGE_BUILD=true`)
   - Verfügbarkeit der `kubectl`-CLI
   - Erreichbarkeit des Cluster-Ziels über `kubectl cluster-info` (mit Retry und
     `--request-timeout=60s`)
   - Ausgabe von Kontext, Cluster und Server-Version des Zielclusters
   - erforderliche Deployment-Dateien auf dem Datenträger
   - Vorhandensein von `GITHUB_USERNAME`
2. Dev-Base-Image lokal aus `scripts/bootstrap/docker-dev-base/Dockerfile` bauen
3. Runner-Image lokal aus `scripts/bootstrap/docker-dev-ghrunner/Dockerfile` bauen, wobei das soeben
   gebaute Base-Image als `DEV_BASE_IMAGE` dient
4. Kaniko-Image lokal aus `scripts/bootstrap/docker-dev-kaniko/Dockerfile` bauen
5. Bei der Registry anmelden und **alle drei** Images pushen
6. `scripts/bootstrap/k8s/namespace.yaml` mit dem konfigurierten Namespace rendern und anwenden
7. Das RBAC-Template `scripts/bootstrap/k8s/rbac.yaml` rendern und anwenden
8. Einen frischen Repository-Runner-Registration-Token holen, die Platzhalter in
   `scripts/bootstrap/k8s/runner-secrets.yaml` ersetzen und die gerenderten Secret-Manifeste per
   `kubectl apply` anwenden
9. `__NAMESPACE__`, `__RUNNER_IMAGE__` und `__PART_OF__` in
   `scripts/bootstrap/k8s/runner-deployment.yaml` ersetzen, das gerenderte Deployment anwenden und
   einen Rollout-Restart auslösen
10. Auf den Abschluss des Deployment-Rollouts warten

Bei `SKIP_IMAGE_BUILD=true` läuft Step 1 weiterhin (inklusive der Kubeconfig-Prüfung), überspringt
aber die Docker-spezifischen Prüfungen und die Anforderung der Build-only-Images, und Steps 2-5
werden geloggt und explizit übersprungen, während Steps 6-10 weiterlaufen.

Das Kaniko-Image wird bewusst hier gebaut und nicht in einem Workflow: Ein künftiger
Anwendungs-Deploy-Workflow benötigt ein einsatzbereites Executor-Image, bevor er irgendeinen
Build-Job starten kann. Es wird hier gebaut, aber dort verwendet — das Runner-Deployment selbst
referenziert es nicht.

## Runner-Replicas

Das Deployment läuft mit `spec.replicas: 2`. Jeder Pod registriert sich unter seinem eigenen
Pod-Namen, sodass bis zu zwei Workflow-Jobs parallel laufen können, statt sich auf einen einzigen
Runner-Slot zu serialisieren. Der Entrypoint stellt `RUNNER_NAME_PREFIX` nur dann voran, wenn der
Pod-Name das Präfix nicht schon enthält, sonst entstünden doppelt präfigierte Namen.

## Registrierung prüfen

```powershell
gh api repos/<owner>/<repo>/actions/runners --jq '.runners[].name'
```

## Referenz für manuellen Image-Build

Die Image-Referenzen kommen aus `bootstrap.json`; für einen manuellen Lauf setzt man dieselben Werte
als Umgebungsvariablen:

```bash
DEV_BASE_IMAGE="<registry>/<dev-base-image>:<tag>"
GH_RUNNER_IMAGE="<registry>/<runner-image>:<tag>"
KANIKO_IMAGE="<registry>/<kaniko-image>:<tag>"

echo "$GITHUB_PAT" | docker login <registry> -u "$GITHUB_USERNAME" --password-stdin

docker build \
  -f scripts/bootstrap/docker-dev-base/Dockerfile \
  -t "$DEV_BASE_IMAGE" \
  scripts/bootstrap/docker-dev-base

docker build \
  --build-arg DEV_BASE_IMAGE="$DEV_BASE_IMAGE" \
  -f scripts/bootstrap/docker-dev-ghrunner/Dockerfile \
  -t "$GH_RUNNER_IMAGE" \
  scripts/bootstrap/docker-dev-ghrunner

docker build \
  -f scripts/bootstrap/docker-dev-kaniko/Dockerfile \
  -t "$KANIKO_IMAGE" \
  scripts/bootstrap/docker-dev-kaniko

docker push "$DEV_BASE_IMAGE"
docker push "$GH_RUNNER_IMAGE"
docker push "$KANIKO_IMAGE"
```

## Tests

`scripts/bootstrap/bootstrap.test.mjs` leitet alle Erwartungen aus `bootstrap.json` ab und prüft:

- dass die Manifest-Dateinamen, die `bootstrap.mjs` referenziert, existieren (`namespace.yaml`,
  `rbac.yaml`, `runner-secrets.yaml`, `runner-deployment.yaml`)
- dass die Fail-fast-Meldungen für fehlenden Namespace, fehlende Image-Referenzen und ein ungültiges
  `partOf`-Label vorhanden sind
- dass `__PART_OF__` aus der Konfiguration bzw. dem Repository-Namen gerendert wird
- dass das gesamte Paket (inklusive Markdown) außerhalb von `bootstrap.json` kein Projekt-Literal
  enthält — der Portabilitäts-Guard

```bash
npm run test:bootstrap
```

Die Tests nutzen ausschließlich den Node-eigenen Test-Runner (`node --test`), damit keine
zusätzliche Test-Dependency nötig ist.