# Runner-Image (`ghRunnerImage`)

Das Kubernetes-Self-hosted-GitHub-Actions-Runner-Image. Es erweitert das Dev-Base-Image, sodass die
Runner-spezifische Schicht nur die GitHub-Actions-Runner-Binary sowie den Registrierungs-Entrypoint
ergänzt.

Beide Image-Referenzen sind projektabhängig und stehen ausschließlich in
[`../bootstrap.json`](../bootstrap.json): `ghRunnerImage` für dieses Image, `devBaseImage` für den
Parent. `bootstrap.mjs` hat keine eingebauten Image-Namen.

## Parent-Image

Das Dockerfile hat für `DEV_BASE_IMAGE` **keinen Default**: `bootstrap.mjs` übergibt den Wert immer
per `--build-arg DEV_BASE_IMAGE=<Tag aus bootstrap.json>`. Ein eigenständiger `docker build` muss den
Wert deshalb ebenfalls explizit setzen.

`bootstrap.mjs` baut und taggt zuerst das Dev-Base-Image und übergibt dann denselben Tag an den
Runner-Image-Build.

## Ergänzungen auf Basis des Dev-Base-Images

- GitHub-Actions-Runner-Binary, gepinnt auf `RUNNER_VERSION=2.337.0`
- `crane`-Client, gepinnt auf `GO_CONTAINERREGISTRY_VERSION=v0.22.1`
- `kubectl`-Client, gepinnt auf `KUBECTL_VERSION=v1.33.0`, SHA256-verifiziert gegen die offizielle
  Prüfsumme unter `https://dl.k8s.io/release/v1.33.0/bin/linux/amd64/kubectl.sha256`. Erforderlich,
  weil ein künftiger Anwendungs-Deploy-Workflow `kubectl apply/create/wait/logs/delete` direkt in
  diesem Container ausführt: Anwenden der App-Manifeste, Erneuern von `ghcr-pull-secret` und
  Verwalten der kurzlebigen Kaniko-Build-Jobs aus dem Kaniko-Image.
- Installation der Runner-Abhängigkeiten über `./bin/installdependencies.sh`
- Der Registrierungs-/Laufzeit-Entrypoint, der `REPO_URL`, `RUNNER_TOKEN`, `RUNNER_NAME_PREFIX`,
  `RUNNER_LABELS` und `RUNNER_SCOPE` konsumiert

## Laufzeit-Nutzer

Der finale Laufzeit-Nutzer bleibt `appuser`, geerbt vom Base-Image. Die Runner-Dateien liegen unter
`/home/appuser/actions-runner` und gehören `appuser`.

## Runner-Identität

Der Entrypoint bildet den Runner-Namen aus `RUNNER_NAME_PREFIX` und `POD_NAME`. Das Präfix
(Standard `github-actions-runner`) wird nur vorangestellt, wenn der Pod-Name es nicht bereits
enthält: Pods heißen im Deployment schon `github-actions-runner-<hash>-<suffix>`, ein unbedingtes
Voranstellen erzeugte doppelte Namen wie
`github-actions-runner-github-actions-runner-55795b4dcb-2wjn6`. Das Deployment läuft mit zwei
Replicas; jeder Pod registriert sich damit unter einer eigenen Identität statt die andere zu
ersetzen.

## Build

```bash
DEV_BASE_IMAGE="<registry>/<dev-base-image>:<tag>"
GH_RUNNER_IMAGE="<registry>/<runner-image>:<tag>"

docker build \
  --build-arg DEV_BASE_IMAGE="$DEV_BASE_IMAGE" \
  -f scripts/bootstrap/docker-dev-ghrunner/Dockerfile \
  -t "$GH_RUNNER_IMAGE" \
  scripts/bootstrap/docker-dev-ghrunner
```

Ohne `--build-arg DEV_BASE_IMAGE=...` bricht der Build ab, weil das Dockerfile keinen Default mehr
hat. Der reguläre Weg ist `scripts/bootstrap/bootstrap.mjs`, das den Wert aus `bootstrap.json`
einsetzt.