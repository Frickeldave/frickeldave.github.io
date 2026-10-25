# fd-dev-ghrunner

`fd-dev-ghrunner` ist das Kubernetes-Self-hosted-GitHub-Actions-Runner-Image für
`Frickeldave/frickeldave.github.io`. Es erweitert `fd-dev-base`, sodass die Runner-spezifische
Schicht nur die GitHub-Actions-Runner-Binary sowie den Registrierungs-Entrypoint ergänzt.

## Parent-Image

Das Dockerfile erwartet eine zur Build-Zeit verfügbare Base-Image-Referenz über `DEV_BASE_IMAGE`.
Standardmäßig wird verwendet:

```text
ghcr.io/frickeldave/fd-dev-base:latest
```

Beim lokalen Bootstrap baut und taggt `scripts/bootstrap/bootstrap.mjs` zuerst dieses Base- Image
und übergibt dann denselben Tag mit `--build-arg DEV_BASE_IMAGE=<tag>` an den Runner-Image-Build.

## Ergänzungen auf Basis von `fd-dev-base`

- GitHub-Actions-Runner-Binary, gepinnt auf `RUNNER_VERSION=2.337.0`
- `crane`-Client, gepinnt auf `GO_CONTAINERREGISTRY_VERSION=v0.22.1`
- `kubectl`-Client, gepinnt auf `KUBECTL_VERSION=v1.33.0`, SHA256-verifiziert gegen die offizielle
  Prüfsumme unter `https://dl.k8s.io/release/v1.33.0/bin/linux/amd64/kubectl.sha256`. Erforderlich,
  weil ein künftiges `fd-deploy.yaml` `kubectl apply/create/wait/logs/delete` direkt in diesem
  Container ausführt: Anwenden der App-Manifeste, Erneuern von `ghcr-pull-secret` und Verwalten der
  kurzlebigen Kaniko-Build-Jobs aus `fd-dev-kaniko`.
- Installation der Runner-Abhängigkeiten über `./bin/installdependencies.sh`
- Der Registrierungs-/Laufzeit-Entrypoint, der `REPO_URL`, `RUNNER_TOKEN`, `RUNNER_NAME_PREFIX`,
  `RUNNER_LABELS` und `RUNNER_SCOPE` konsumiert

## Laufzeit-Nutzer

Der finale Laufzeit-Nutzer bleibt `appuser`, geerbt vom Base-Image. Die Runner-Dateien liegen unter
`/home/appuser/actions-runner` und gehören `appuser`.

## Runner-Identität

Der Entrypoint bildet den Runner-Namen als
`${RUNNER_NAME_PREFIX:-github-actions-runner}-${POD_NAME}`. Das Deployment läuft mit zwei Replicas;
jede Pod registriert sich damit unter einer eigenen Identität statt die andere zu ersetzen.

## Build

```bash
docker build \
  --build-arg DEV_BASE_IMAGE=ghcr.io/frickeldave/fd-dev-base:latest \
  -f scripts/bootstrap/docker-dev-ghrunner/Dockerfile \
  -t ghcr.io/frickeldave/fd-dev-ghrunner:latest \
  scripts/bootstrap/docker-dev-ghrunner
```
