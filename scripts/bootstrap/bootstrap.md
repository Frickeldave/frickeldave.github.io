# Runner-Bootstrap: Betrieb und Konfiguration

Dieses Dokument beschreibt nur den Betrieb des Self-hosted GitHub-Actions-Runners für
`Frickeldave/frickeldave.github.io`. Ein Anwendungs-Deployment (`fd-deploy.yaml`) existiert in
diesem Repository noch nicht; die Kaniko-Bausteine sind vorbereitet, aber nicht verdrahtet.

## Zielbild

| Element              | Wert                                         |
| -------------------- | -------------------------------------------- |
| GitHub-Repository    | `Frickeldave/frickeldave.github.io`          |
| Runner-Scope         | `repo`                                       |
| Kubernetes-Namespace | aus `bootstrap.json` (`namespace`)           |
| Deployment           | `github-actions-runner`                      |
| Replicas             | `2`                                          |
| Runner-Label         | `fd`                                         |
| Kubeconfig           | `C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml` |

Die Runner registrieren sich als `github-actions-runner-<pod-name>` (der Entrypoint hängt `POD_NAME`
an `RUNNER_NAME_PREFIX` an), damit beide Replicas gleichzeitig Jobs annehmen können.

## Voraussetzungen auf dem Operator-Rechner

- Docker-CLI mit laufendem Daemon (die drei Images werden lokal gebaut und gepusht)
- `kubectl` im `PATH`
- Node.js 24 oder neuer (der PowerShell-Wrapper installiert es bei Bedarf via `winget`)
- Ein klassischer Personal Access Token mit den Scopes `repo`, `read:packages` und `write:packages`

## Ablauf auf Windows

```powershell
# 1. Token und GHCR-Benutzer bereitstellen (nicht committen, nicht in Issues posten)
$env:GITHUB_PAT = "ghp_xxxxx"
$env:GITHUB_USERNAME = "Frickeldave"

# 2. Bootstrap gegen den dev-Cluster ausführen
#    (Namespace kommt aus scripts/bootstrap/bootstrap.json)
.\scripts\bootstrap\bootstrap.ps1 `
  -Kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml

# 3. Registrierung prüfen
gh api repos/Frickeldave/frickeldave.github.io/actions/runners --jq '.runners[].name'
```

`-Kubeconfig` exportiert `KUBECONFIG` für die Dauer des Laufs (und stellt den vorherigen Wert danach
wieder her) und reicht den Pfad zusätzlich als `--kubeconfig` an `bootstrap.mjs` weiter. Ohne den
Parameter greift der `kubeconfig`-Schlüssel aus `bootstrap.json`, danach `$env:KUBECONFIG`, danach
der aktuelle kubectl-Kontext.

## Was das Bootstrap anwendet

1. `k8s/fd-k8s-namespaces.yaml` — rendert den konfigurierten Namespace und legt ihn an
2. `k8s/fd-k8s-rbac.yaml` — Kaniko-Builder-Role und -RoleBinding im gewählten Namespace
   (der `namespace`-Wert aus `bootstrap.json`)
3. `k8s/fd-k8s-ghrunner-secrets.yaml` — `github-runner-registration` (frischer Registration-Token
   pro Lauf) und `ghcr-pull-secret`
4. `k8s/fd-k8s-ghrunner-deployments.yaml` — das Runner-Deployment, gefolgt von
   `kubectl rollout restart` und `kubectl rollout status`

Alle Schritte sind idempotent; ein erneuter Lauf rotiert den Registration-Token und rollt die Pods
neu aus.

## Schritt 1: Diagnose

Step 1 prüft in dieser Reihenfolge und bricht beim ersten Fehler ab:

- aufgelöste Kubeconfig existiert (bei konfiguriertem Pfad)
- Docker-CLI und Daemon (übersprungen bei `SKIP_IMAGE_BUILD=true`)
- `kubectl`-CLI aufrufbar
- `kubectl cluster-info` erreichbar (3 Versuche, Backoff, `--request-timeout=60s`)
- Ausgabe von Kubeconfig-Pfad, Kontext, Cluster-Name und Server-Version
- erforderliche Dateien unter `scripts/bootstrap/`
- `GITHUB_USERNAME` gesetzt

Die Cluster-Ausgabe ist die eigentliche Sicherung: Sie zeigt vor dem ersten `kubectl apply`, welcher
Cluster getroffen wird.

## Images ohne Rebuild wiederverwenden

Existieren die drei Images bereits in GHCR und müssen nur Secrets und Deployment aktualisiert
werden:

```powershell
$env:SKIP_IMAGE_BUILD = "true"
.\scripts\bootstrap\bootstrap.ps1 -Kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml
```

Steps 2 bis 5 werden dann explizit übersprungen, Steps 6 bis 10 laufen weiter.

## Runner-only: was hier bewusst fehlt

- Keine Anwendungs-Secrets, keine App-Manifeste, keine App-RBAC. Das Bootstrap kennt nur den
  konfigurierten Namespace und den Runner.
- Kein `fd-deploy.yaml`. Bis dieses Workflow existiert, baut das Bootstrap nur die drei Images; das
  Kaniko-Image wird gebaut und gepusht, aber nicht eingesetzt.
- Keine Repository-Secrets. `GITHUB_PAT` kommt ausschließlich aus der Umgebung oder aus dem
  maskierten Prompt.

## Fehlerbehebung

| Symptom                                                                | Ursache / Lösung                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Kubeconfig not found: ...`                                            | Pfad in `-Kubeconfig`, `KUBECONFIG` oder `bootstrap.json` prüfen; es wurde nichts angewendet                |
| `kubectl could not reach the target cluster after 3 attempts`          | Rancher-Proxy/VPN nicht erreichbar; der Fehler listet alle drei Versuche und den benutzten Kubeconfig-Pfad  |
| `Docker CLI found, but the Docker daemon is not reachable`             | Docker Desktop starten und erneut ausführen                                                                 |
| `GitHub API returned 403 while requesting a runner registration token` | PAT ohne `repo`-Scope, fehlende Admin-Rechte am Repository oder offene SSO-Autorisierung                    |
| Rollout bleibt in `ImagePullBackOff`                                   | `ghcr-pull-secret` prüfen: der PAT muss `read:packages` besitzen und für das Repository freigeschaltet sein |
