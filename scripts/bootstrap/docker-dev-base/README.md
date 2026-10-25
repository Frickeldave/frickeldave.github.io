# fd-dev-base

`fd-dev-base` ist das wiederverwendbare Ubuntu-24.04-Entwicklungs-Basisimage für dieses Projekt. Es
ist bewusst frei vom Runner, sodass andere Dev-Container dieselbe Baseline wiederverwenden können,
ohne die GitHub-Actions-Runner-Binary mitzuführen.

## Inhalt

- Ubuntu 24.04 (`ubuntu:24.04`)
- Node.js 24
- GitHub CLI (`gh`)
- GitHub Copilot CLI (`@github/copilot`)
- Playwright, gepinnt auf die aktuelle `@playwright/test`-Version des Repositories (derzeit
  `1.63.0`), mit dazu passendem Chromium, Firefox und WebKit sowie deren Linux-Systemabhängigkeiten
- Browser und Systemabhängigkeiten werden mit derselben gepinnten Playwright-Version installiert
  (`install-deps`, danach `install chromium firefox webkit`)
- Squad CLI (`@bradygaster/squad-cli`, inkl. `squad rc`) und `kubectl` (gepinnt, Checksum-geprüft)
- Allgemeines CLI-Tooling: `git`, `jq`, `rg`, `build-essential`, Python 3 mit dem Kommando `python`
  (`/usr/bin/python`), `python3-pil` (Pillow, importierbar als `PIL`), `python3-pip`,
  `python3-venv`, `curl`, `ca-certificates`, `locales`, Archiv-Tools, Editoren und Prozess-Utilities

Dieses Image ist die einzige Toolchain-Definition; das Runner-Image erbt davon.

## Laufzeit-Nutzer

Der finale Laufzeit-Nutzer ist `appuser` mit dem Home-Verzeichnis `/home/appuser`. Die
Playwright-Browser liegen in `/opt/ms-playwright` und sind für diesen Nutzer lesbar.

## Build

```bash
docker build \
  -f scripts/bootstrap/docker-dev-base/Dockerfile \
  -t ghcr.io/frickeldave/fd-dev-base:latest \
  scripts/bootstrap/docker-dev-base
```

Das Image verwendet einen winzigen Pass-through-Entrypoint, sodass `docker run ... <command>` sich
normal verhält. Ohne expliziten Befehl fällt es auf `bash` zurück.
