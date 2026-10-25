# fd-dev-kaniko

`fd-dev-kaniko` ist das projekteigene Kaniko-Executor-Image für Wegwerf-Build-Jobs im Runner-Namespace. Es
wird heute nur gebaut und gepusht; ein künftiges `fd-deploy.yaml` startet daraus pro Image-Build
einen Kubernetes-Job.

## Quelle und Build

Das Laufzeit-Image startet von `ubuntu:24.04`. Es erbt nicht von `gcr.io/kaniko-project/executor`
oder einem anderen vorgebauten Kaniko-Image. Seine Builder- Stage klont das offizielle
[Kaniko-Repository](https://github.com/GoogleContainerTools/kaniko), checkt den Commit
`1ae9a8416c14418625de90c1115052c0a6ebee07` aus und verifiziert, dass es der offizielle Tag `v1.23.2`
ist, bevor `./cmd/executor` mit der Go-1.22-Toolchain von Ubuntu kompiliert wird.

Das finale Image enthält nur den statischen Executor und Ubuntu-Laufzeitdateien. Es läuft als
numerische UID/GID `1000:1000` und startet standardmäßig mit `sleep infinity`, sodass dasselbe Image
bei Bedarf als Idle-Container genutzt werden kann.

## Kubernetes-Integration

Das Image wird als eigenständiges Build-Image verwendet, nicht als `initContainer` des Runner-Pods.
Das Runner-Deployment referenziert es nicht. Ein künftiges `fd-deploy.yaml` rendert einen
`batch/v1`-Job im konfigurierten Runner-Namespace, wartet darauf, gibt dessen Logs aus und löscht ihn wieder. Das
RBAC-Template `scripts/bootstrap/k8s/fd-k8s-rbac.yaml` enthält dafür bereits die
`kaniko-builder`-Role und das RoleBinding.

Innerhalb dieses Jobs läuft der Executor als **root** (`runAsUser: 0`, `runAsGroup: 0`). Kaniko
extrahiert das Base-Image-Dateisystem direkt nach `/` seines eigenen Containers und benötigt dort
uneingeschränkten `chown`-/Schreibzugriff. Läuft es als Nicht-Root oder als Subprozess im
langlebigen Runner-Container, schlägt es fehl mit
`chown /kaniko/Dockerfile: operation not permitted` und
`error removing bin to make way for new symlink: permission denied` - und wenn es dennoch gelänge,
würde es das eigene `/bin` und `/usr` des Runners überschreiben.

Root in einem Wegwerf-Build-Pod ist Prozessisolation, nicht Host-Root: Der Job hat kein
`privileged: true`, keine zusätzlichen Capabilities, keinen hostPath, kein Host-Netzwerk und keine
Host-PID, und der Pod wird nach jedem Build gelöscht.

`ghcr-pull-secret` wird schreibgeschützt als `/kaniko/.docker/config.json` gemountet, und
`DOCKER_CONFIG` zeigt dorthin, was sowohl den Base-Image-Pull als auch den Push abdeckt. Das Secret
wird nie dekodiert oder ausgegeben.

## Verwendung im Workflow

Kaniko klont den Build-Kontext selbst über seinen Git-Context-Typ, sodass kein Workspace mit dem
Runner-Pod geteilt wird. Das private Repository wird über die Umgebungsvariablen
`GIT_USERNAME`/`GIT_PASSWORD` authentifiziert (das Passwort stammt aus einem kurzlebigen Secret)
statt über einen Token in der URL, sodass der Token nie in `kubectl get job -o yaml` oder in
Kubernetes-Event-Logs erscheint.

```yaml
args:
  - --context=git://github.com/frickeldave/frickeldave.github.io.git#refs/heads/dev#<commit-sha>
  # Paths are relative to the root of the cloned repository.
  - --dockerfile=<path/to/Dockerfile>
  - --destination=ghcr.io/frickeldave/<image>:<version>
  - --destination=ghcr.io/frickeldave/<image>:<commit-sha>
```

Die Branch-Referenz wird nur für den Clone verwendet; die explizite Commit-ID wird tatsächlich
ausgecheckt und gebaut, was Builds reproduzierbar hält.

## Build

`scripts/bootstrap/bootstrap.mjs` baut und pusht dieses Image automatisch. So baust du es manuell:

```bash
docker build \
  -f scripts/bootstrap/docker-dev-kaniko/Dockerfile \
  -t ghcr.io/frickeldave/fd-dev-kaniko:latest \
  scripts/bootstrap/docker-dev-kaniko
```
