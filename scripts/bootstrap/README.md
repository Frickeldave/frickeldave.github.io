# Kubernetes-Runner-Bootstrap

Dieser Ordner enthält die eigenständigen Bootstrap-Assets, um den GitHub-Actions-Self-hosted-Runner
für `Frickeldave/frickeldave.github.io` in Kubernetes zu betreiben. Das Bootstrap besitzt
ausschließlich den Runner und dessen Infrastruktur (Namespace, Images, Secrets, Deployment). Ein
Anwendungs-Deployment (`fd-deploy.yaml`) gibt es in diesem Repository noch nicht; die
Kaniko-Bausteine werden bereits mitgeliefert, damit dieses Deployment später darauf aufsetzen kann.

Es ist bewusst **nicht** das vollständige Actions-Runner-Controller-(ARC)-Design. Dies ist die
einfachere Bootstrap-Schicht für Namespaces, Images, Secrets und das erste Runner-Deployment.

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
    ├── fd-k8s-ghrunner-deployments.yaml
    ├── fd-k8s-ghrunner-secrets.yaml
    ├── fd-k8s-namespaces.yaml
    └── fd-k8s-rbac.yaml
```

Weiterführende Dokumente: [`bootstrap.md`](bootstrap.md) (Runner-only-Betrieb),
[`docker-dev-base/README.md`](docker-dev-base/README.md),
[`docker-dev-ghrunner/README.md`](docker-dev-ghrunner/README.md),
[`docker-dev-kaniko/README.md`](docker-dev-kaniko/README.md).

Tests: `npm run test:bootstrap` (eingebauter `node --test`-Runner, keine zusätzliche
Test-Dependency).

## Zielwerte

| Element              | Wert                                         |
| -------------------- | -------------------------------------------- |
| GitHub-Repository    | `Frickeldave/frickeldave.github.io`          |
| Runner-Scope         | `repo`                                       |
| Kubernetes-Namespace | aus `bootstrap.json` (`namespace`)           |
| Kubeconfig           | `C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml` |
| Replicas             | `2` (`github-actions-runner-<pod-name>`)     |
| Runner-Label         | `fd`                                         |
| Runner-Image         | `ghcr.io/frickeldave/fd-dev-ghrunner:latest` |

## Images

### `fd-dev-base`

- Dockerfile: `scripts/bootstrap/docker-dev-base/Dockerfile`
- Standard-Tag: `ghcr.io/frickeldave/fd-dev-base:latest`
- Zweck: wiederverwendbares Ubuntu-24.04-Entwicklungs-Basisimage
- Enthält Node.js 24, GitHub CLI, GitHub Copilot CLI, Squad CLI, Playwright 1.63.0 mit
  vorinstalliertem Chromium/Firefox/WebKit, Playwright- Systemabhängigkeiten, `kubectl` und das
  allgemeine CLI-Tooling (`git`, `jq`, `rg`, `build-essential`, Python 3 samt `python`-Kommando und
  Pillow, `curl`, `ca-certificates`, `locales`, Archiv-/Prozess-Tools usw.)
- Finaler Laufzeit-Nutzer: `appuser`
- Enthält **nicht** die GitHub-Actions-Runner-Binary

### `fd-dev-ghrunner`

- Dockerfile: `scripts/bootstrap/docker-dev-ghrunner/Dockerfile`
- Standard-Tag: `ghcr.io/frickeldave/fd-dev-ghrunner:latest`
- Zweck: GitHub-Actions-Runner-Image auf Basis von `fd-dev-base`
- Ergänzt die gepinnte GitHub-Runner-Binary (`RUNNER_VERSION=2.337.0`), den gepinnten `crane`-Client
  (`v0.22.1`) und die Logik des Registrierungs-Entrypoints
- Finaler Laufzeit-Nutzer: `appuser`
- Der Entrypoint setzt `RUNNER_NAME=<RUNNER_NAME_PREFIX>-<POD_NAME>` mit dem Default-Präfix
  `github-actions-runner`, damit beide Replicas unter unterschiedlichen Runner-Identitäten
  registriert werden

### `fd-dev-kaniko`

- Dockerfile: `scripts/bootstrap/docker-dev-kaniko/Dockerfile`
- Standard-Tag: `ghcr.io/frickeldave/fd-dev-kaniko:latest`
- Zweck: projekteigener Kaniko-Executor für Build-Jobs aus dem Cluster
- Gebaut aus `ubuntu:24.04`, nicht aus `gcr.io/kaniko-project/executor` oder einem anderen
  vorgebauten Kaniko-Image
- Baut den Executor aus dem offiziellen Kaniko-`v1.23.2`-Quellcode am Commit
  `1ae9a8416c14418625de90c1115052c0a6ebee07` und verifiziert die Herkunft vor dem Kompilieren
- Finaler Laufzeit-Nutzer: numerisch `1000:1000`; Standardbefehl: `sleep infinity`
- Wird von `scripts/bootstrap/bootstrap.mjs` gebaut und gepusht, aber vom Runner-Deployment
  **nicht** referenziert. Ein künftiges `fd-deploy.yaml` startet daraus Wegwerf-Jobs; deshalb
  bleiben Image, Build-Steps und RBAC erhalten

## Kubernetes-Manifeste

Die Manifest-Templates sind zur besseren Reviewbarkeit als einfaches YAML committet:

- `scripts/bootstrap/k8s/fd-k8s-namespaces.yaml` — Namespace-Erstellung (Template mit
  `__NAMESPACE__`)
- `scripts/bootstrap/k8s/fd-k8s-ghrunner-secrets.yaml` — Template mit beiden Secrets
  (`github-runner-registration` und `ghcr-pull-secret`)
- `scripts/bootstrap/k8s/fd-k8s-ghrunner-deployments.yaml` — Template für das Runner-Deployment (2
  Replicas)
- `scripts/bootstrap/k8s/fd-k8s-rbac.yaml` — Template für die Kaniko-Builder-Role und das
  RoleBinding des Runners

Platzhalter-Konvention: Jeder zur Laufzeit ersetzte Wert verwendet `__NAME__`-Token. `bootstrap.mjs`
ersetzt diese Platzhalter im Speicher unmittelbar vor `kubectl apply`. Echte Secrets werden nie
committet.

## Runner-Build-Architektur

Image-Builds finden **nicht** im Runner-Pod statt. Ein künftiges `fd-deploy.yaml` soll
`fd-dev-kaniko` als `batch/v1`-Job im konfigurierten Runner-Namespace starten, auf den Job warten, dessen Logs ins
Actions-Log ausgeben und ihn wieder löschen. Bis dieses Workflow existiert, baut das Bootstrap nur
die drei Images.

Kaniko läuft **als root in diesem Job** (`runAsUser: 0`, `runAsGroup: 0`). Es extrahiert das
Base-Image-Dateisystem direkt nach `/` seines eigenen Containers und benötigt dort uneingeschränkten
`chown`-/Schreibzugriff; als Nicht-Root- Subprozess des Runner-Containers schlägt es mit
`permission denied` auf `/bin` und `chown /kaniko/Dockerfile: operation not permitted` fehl, und als
root im Runner würde es das eigene `/bin` und `/usr` des Runners überschreiben. Root in einem
Wegwerf-Build-Pod ist nur Prozessisolation: Der Job hat kein `privileged: true`, keine zusätzlichen
Capabilities, keinen hostPath, kein Host-Netzwerk, keine Host-PID, und der Pod wird nach jedem Build
entfernt.

Der Runner-Pod behält einen schreibgeschützten `ghcr-pull-secret`-Mount unter
`/home/appuser/.registry-docker`, auf den `DOCKER_CONFIG` zeigt. Das ist **kein** Überbleibsel: Ein
künftiges `fd-deploy.yaml` führt `crane manifest` im Runner-Container aus, um zu entscheiden, ob ein
versioniertes Image bereits in GHCR existiert, und diese Abfrage benötigt
Registry-Authentifizierung. Der Runner-Pod nutzt UID/GID 1001, `RuntimeDefault`-Seccomp und
entzogene Linux-Capabilities und hat keinen Docker-Socket, keinen privilegierten Container, keinen
Host-Pfad, kein Host-Netzwerk und keine Host-PID/IPC.

## Erforderliche Berechtigungen des Runner-ServiceAccounts

`scripts/bootstrap/k8s/fd-k8s-rbac.yaml` ist das sichtbare RBAC-Template zum Review. In Step 7
rendert `bootstrap.mjs` es mit dem gewählten Runner-Namespace und wendet die resultierenden Roles
und RoleBindings an.

Die generierten Berechtigungen sind auf die Kaniko-Baufähigkeit beschränkt:

- `kaniko-builder`-Role und -RoleBinding im gewählten Runner-Namespace (dem `namespace`-Wert aus
  `bootstrap.json`), die
  dem Runner-ServiceAccount `<namespace>:default` erlauben, Kaniko-Jobs zu erstellen, zu beobachten
  und zu löschen.

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

Platzhalter der Bootstrap-Templates:

- Namespace-Template: `__NAMESPACE__`
- Secrets-Template: `__NAMESPACE__`, `__REPO_URL__`, `__RUNNER_TOKEN__`, `__RUNNER_NAME__`,
  `__RUNNER_SCOPE__`, `__RUNNER_LABELS__`, `__DOCKERCONFIGJSON__`
- Runner-Deployment-Template: `__NAMESPACE__`, `__RUNNER_IMAGE__`
- RBAC-Template: `__NAMESPACE__`

## Hinweis zur Namespace-Benennung

Kubernetes-Namespace-Namen müssen den RFC-1123-DNS-Label-Regeln folgen. Der Name steht
ausschließlich in `scripts/bootstrap/bootstrap.json` (`namespace`); Skripte und Templates enthalten
kein Literal. Für ein anderes Zielprojekt reicht es, diese eine Zeile zu ändern.

## Rangfolge der Konfiguration

`bootstrap.mjs` löst Einstellungen in dieser Reihenfolge auf:

1. CLI-Argumente (`-n` / `--namespace`, `-k` / `--kubeconfig`)
2. Umgebungsvariablen
3. `scripts/bootstrap/bootstrap.json`
4. eingebaute Defaults im Skript — **nicht** für den Namespace: fehlt er in CLI und Config, bricht
   `bootstrap.mjs` mit einer klaren Meldung ab, statt einen Namen zu erfinden

Die committete JSON-Konfigurationsdatei ist bewusst nur für **nicht geheime** Defaults gedacht. Sie
unterstützt diese Schlüssel:

| JSON key           | Purpose                                                     | Wert in diesem Repo                          |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------- |
| `namespace`        | Standard-Ziel-Namespace (Pflicht, kein Built-in-Default).   | aus `bootstrap.json`                         |
| `kubeconfig`       | Kubeconfig für alle kubectl-Aufrufe.                        | `C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml` |
| `devBaseImage`     | In Step 2 gebauter/gepushter Image-Tag, genutzt als Parent. | `ghcr.io/frickeldave/fd-dev-base:latest`     |
| `ghRunnerImage`    | In Steps 3/5 gebauter/gepushter und deployter Image-Tag.    | `ghcr.io/frickeldave/fd-dev-ghrunner:latest` |
| `kanikoImage`      | In Step 4 gebauter Image-Tag, für künftige Build-Jobs.      | `ghcr.io/frickeldave/fd-dev-kaniko:latest`   |
| `skipImageBuild`   | Überspringt alle drei lokalen Builds und alle drei Pushes.  | `false`                                      |
| `githubUsername`   | GitHub-Username für GHCR-Auth und Pull-Secret-Daten.        | `Frickeldave`                                |
| `githubRunnerOrg`  | GitHub-Owner zur Ableitung von `REPO_URL`.                  | `Frickeldave`                                |
| `githubRunnerRepo` | GitHub-Repository zur Ableitung von `REPO_URL`.             | `frickeldave.github.io`                      |
| `runnerName`       | Runner-Namenspräfix, im Secret gespeichert.                 | `github-actions-runner`                      |
| `runnerLabels`     | Standardmäßige kommagetrennte Runner-Labels.                | `fd`                                         |
| `runnerScope`      | Kompatibilitätswert, im Secret gespeichert.                 | `repo`                                       |

`GITHUB_PAT` wird **nie** aus dieser JSON-Datei gelesen. Als Defense-in-Depth- Sicherheitsprüfung
verweigert das Skript die Ausführung, wenn die Konfigurationsdatei einen PAT-ähnlichen
GitHub-Schlüssel wie `githubPat`, `github_pat` oder Ähnliches enthält.

## Umgebungsvariablen

| Variable             | Required | Purpose                                                                                                                                                                                                                                                                                        |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_PAT`         | Ja       | Klassischer PAT für `docker login ghcr.io`, das gerenderte GHCR-Pull-Secret und den GitHub-Runner-Registration-Token-API-Aufruf                                                                                                                                                                |
| `GITHUB_USERNAME`    | Ja       | GitHub-Username, gepaart mit `GITHUB_PAT` für GHCR-Auth und das GHCR-Pull-Secret                                                                                                                                                                                                               |
| `KUBECONFIG`         | Nein     | Kubeconfig für alle kubectl-Aufrufe. Wird von `-k` / `--kubeconfig` und vom `kubeconfig`-Schlüssel in `bootstrap.json` überstimmt                                                                                                                                                              |
| `DEV_BASE_IMAGE`     | Nein     | Überschreibt den in Step 2 gebauten Base-Image-Tag                                                                                                                                                                                                                                             |
| `GH_RUNNER_IMAGE`    | Nein     | Überschreibt den in Steps 3/5/9 gebauten/gepushten/deployten Runner-Image-Tag                                                                                                                                                                                                                  |
| `FD_KANIKO_IMAGE`    | Nein     | Überschreibt den in Steps 4/5 gebauten/gepushten Ubuntu-basierten Kaniko-Image-Tag, das künftige Build-Jobs verwenden                                                                                                                                                                          |
| `SKIP_IMAGE_BUILD`   | Nein     | Bei `true` werden alle drei Image-Builds und alle drei Pushes übersprungen                                                                                                                                                                                                                     |
| `GITHUB_RUNNER_ORG`  | Nein     | Überschreibt den GitHub-Owner zur Ableitung von `REPO_URL`                                                                                                                                                                                                                                     |
| `GITHUB_RUNNER_REPO` | Nein     | Überschreibt das GitHub-Repository zur Ableitung von `REPO_URL`                                                                                                                                                                                                                                |
| `RUNNER_NAME`        | Nein     | Überschreibt das **Präfix** des im Secret gespeicherten Runner-Namens (Config-Wert `github-actions-runner`; eingebauter Fallback `github-actions-runner-<namespace>`). Jeder Pod hängt seinen eigenen Pod-Namen an, sodass Replicas unter verschiedenen Runner-Identitäten registriert werden. |
| `RUNNER_LABELS`      | Nein     | Überschreibt die im Secret gespeicherten Runner-Labels                                                                                                                                                                                                                                         |
| `RUNNER_SCOPE`       | Nein     | Überschreibt den im Secret gespeicherten Kompatibilitäts-Scope-Wert                                                                                                                                                                                                                            |

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
7. Erzwingt der Account SSO, autorisiere den Token nach der Erstellung für SSO

Fehlt `GITHUB_PAT` und das Skript hat ein interaktives TTY, fragt `bootstrap.mjs` danach mit
maskierter Eingabe, statt den Token auszugeben.

## Kubernetes-Kontext auswählen

Ohne weitere Angabe nutzt das Bootstrap den aktuellen kubectl-Kontext des Rechners. Für diesen
Cluster ist das nicht gewünscht, deshalb kennt das Skript einen expliziten Kubeconfig-Pfad:

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

Normale Verwendung (Windows-Operator auf diesem Rechner):

```powershell
$env:GITHUB_PAT = "ghp_xxxxx"
$env:GITHUB_USERNAME = "Frickeldave"
# Namespace kommt aus scripts/bootstrap/bootstrap.json
.\scripts\bootstrap\bootstrap.ps1 -Kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml
```

`-Namespace <namespace>` überschreibt den konfigurierten Wert für einen einzelnen Lauf.

Direkt mit dem Node-Skript, ohne PowerShell-Wrapper:

```bash
export GITHUB_PAT=ghp_xxxxx
export GITHUB_USERNAME=Frickeldave
node scripts/bootstrap/bootstrap.mjs --kubeconfig /path/to/dev-kw-bee23d.yaml
```

Alternativ über npm:

```powershell
npm run bootstrap -- --kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml
```

Das Node-Bootstrap-Skript führt diese sichtbaren Schritte der Reihe nach aus:

1. Voraussetzungsprüfungen vor jeder langsamen Arbeit:
   - Existenz der aufgelösten Kubeconfig (bei konfiguriertem Pfad)
   - Verfügbarkeit der Docker-CLI und Erreichbarkeit des Docker-Daemons (beides übersprungen bei
     `SKIP_IMAGE_BUILD=true`)
   - Verfügbarkeit der `kubectl`-CLI
   - Erreichbarkeit des Cluster-Ziels über `kubectl cluster-info` (mit Retry und
     `--request-timeout=60s`)
   - Ausgabe von Kontext, Cluster und Server-Version des Zielclusters
   - erforderliche Deployment-Dateien auf dem Datenträger
   - Vorhandensein von `GITHUB_USERNAME`
2. `fd-dev-base` lokal aus `scripts/bootstrap/docker-dev-base/Dockerfile` bauen
3. `fd-dev-ghrunner` lokal aus `scripts/bootstrap/docker-dev-ghrunner/Dockerfile` bauen, wobei das
   soeben gebaute Base-Image als `DEV_BASE_IMAGE` dient
4. `fd-dev-kaniko` lokal aus `scripts/bootstrap/docker-dev-kaniko/Dockerfile` bauen
5. Bei GHCR anmelden und **alle drei** Images pushen
6. `scripts/bootstrap/k8s/fd-k8s-namespaces.yaml` mit dem konfigurierten Namespace rendern und
   anwenden
7. Das RBAC-Template `scripts/bootstrap/k8s/fd-k8s-rbac.yaml` rendern und anwenden
8. Einen frischen Repository-Runner-Registration-Token holen, die Platzhalter in
   `scripts/bootstrap/k8s/fd-k8s-ghrunner-secrets.yaml` ersetzen und die gerenderten
   Secret-Manifeste per `kubectl apply` anwenden
9. `__RUNNER_IMAGE__` in `scripts/bootstrap/k8s/fd-k8s-ghrunner-deployments.yaml` ersetzen, das
   gerenderte Deployment anwenden und einen Rollout-Restart auslösen
10. Auf den Abschluss des Deployment-Rollouts warten

Bei `SKIP_IMAGE_BUILD=true` läuft Step 1 weiterhin (inklusive der Kubeconfig-Prüfung), überspringt
aber die Docker-spezifischen Prüfungen, und Steps 2-5 werden geloggt und explizit übersprungen,
während Steps 6-10 weiterlaufen.

Das Kaniko-Image wird bewusst hier gebaut und nicht in einem Workflow: Ein künftiges
`fd-deploy.yaml` benötigt ein einsatzbereites Executor-Image, bevor es irgendeinen Build-Job starten
kann. Es wird hier gebaut, aber dort verwendet — das Runner-Deployment selbst referenziert es nicht.

## Runner-Replicas

Das Deployment läuft mit `spec.replicas: 2`. Jeder Pod registriert sich unter einem eindeutigen
Namen (`github-actions-runner-<pod-name>`), sodass bis zu zwei Workflow-Jobs parallel laufen können,
statt sich auf einen einzigen Runner-Slot zu serialisieren.

## Registrierung prüfen

```powershell
gh api repos/Frickeldave/frickeldave.github.io/actions/runners --jq '.runners[].name'
```

## Referenz für manuellen Image-Build

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

docker build \
  -f scripts/bootstrap/docker-dev-base/Dockerfile \
  -t ghcr.io/frickeldave/fd-dev-base:latest \
  scripts/bootstrap/docker-dev-base

docker build \
  --build-arg DEV_BASE_IMAGE=ghcr.io/frickeldave/fd-dev-base:latest \
  -f scripts/bootstrap/docker-dev-ghrunner/Dockerfile \
  -t ghcr.io/frickeldave/fd-dev-ghrunner:latest \
  scripts/bootstrap/docker-dev-ghrunner

docker build \
  -f scripts/bootstrap/docker-dev-kaniko/Dockerfile \
  -t ghcr.io/frickeldave/fd-dev-kaniko:latest \
  scripts/bootstrap/docker-dev-kaniko

docker push ghcr.io/frickeldave/fd-dev-base:latest
docker push ghcr.io/frickeldave/fd-dev-ghrunner:latest
docker push ghcr.io/frickeldave/fd-dev-kaniko:latest
```

## Tests

`scripts/bootstrap/bootstrap.test.mjs` prüft die committeten Zielwerte (Namespace aus
`bootstrap.json`, `ghcr.io/frickeldave/fd-dev-*`, 2 Replicas, Label `fd`), dass Skripte und
Templates kein Namespace-Literal enthalten, und dass in diesem Paket keine Literale des
Ursprungsprojekts mehr stehen:

```bash
npm run test:bootstrap
```

Die Tests nutzen ausschließlich den Node-eigenen Test-Runner (`node --test`), damit keine
zusätzliche Test-Dependency nötig ist.
