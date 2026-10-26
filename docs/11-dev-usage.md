# Nutzung

Dieses Dokument beschreibt, wie das Projekt `frickeldave.de` nach der Einrichtung lokal genutzt
und betrieben wird.

## 🧞 Befehle (Astro)

Alle Befehle werden im Terminal aus dem Projektwurzelverzeichnis ausgeführt:

| Befehl                  | Aktion                                                                     |
| :---------------------- | :------------------------------------------------------------------------- |
| `npm install`           | Installiert Abhängigkeiten und führt den `postinstall`-Hook aus            |
| `npm run dev`           | Startet den lokalen Entwicklungsserver unter `localhost:4321`              |
| `npm run build`         | Rendert die 3D-Modelle und baut die Produktionsversion nach `./dist/`      |
| `npm run format`        | Formatiert Dateien in `src/` mit Prettier                                  |
| `npm run format:check`  | Prüft die Formatierung in `src/`, ohne Dateien zu ändern                   |
| `npm run lint`          | Führt ESLint auf `src/` mit Auto-Fix aus                                   |
| `npm run lint:check`    | Führt ESLint auf `src/` ohne Auto-Fix aus                                  |
| `npm run prose-install` | Installiert die lokale Vale-Binärdatei nach `.vale/`                       |
| `npm run prose`         | Führt Vale gegen `src/content` aus                                         |
| `npm run scad:install`  | Installiert OpenSCAD für den 3D-Build                                      |
| `npm run scad:render`   | Rendert die OpenSCAD-Modelle nach `dist/3dmodels/`                         |
| `npx astro -- --help`   | Zeigt die Hilfe der Astro-CLI an                                           |
| `npx astro add <pkg>`   | Fügt eine Astro-Integration hinzu                                          |

Der `postinstall`-Hook besteht aus `npm run prose-install && npm run scad:install`.

### Squad- und Release-Werkzeuge

| Befehl                             | Aktion                                                                 |
| :--------------------------------- | :--------------------------------------------------------------------- |
| `npm run bootstrap`                | Bootstrappt die self-hosted Runner (siehe `scripts/bootstrap/`)        |
| `npm run test:bootstrap`           | Führt die Tests des Bootstrap-Skripts aus                              |
| `npm run start-work -- IS_<n>`     | Legt Issue-Branch, Worktree und Draft-PR gegen `dev` an                |
| `npm run start-reqeng -- IS_<n>`   | Startet Requirement Engineering für ein Issue                          |
| `npm run start-review -- PR_<n>`   | Startet das Review für einen bestehenden PR                            |
| `npm run versionbump`              | Hebt die Version in `package.json` und ergänzt den `CHANGELOG.md`-Eintrag |
| `npm run test:scripts`             | Führt die Tests der Start-Flow- und Release-Skripte aus                |

Weitere Details zum automatisierten Deployment stehen in
[FR006: Automatisierte Deployment-Workflows](./features/fr006-autodeploy.md).

## 🚀 Automatisches Deployment

Dieses Repository verwendet nicht mehr `npm run deploy:dev` oder `npm run deploy:prd`.

Der aktuelle Ablauf ist workflow-basiert und läuft über die `fd-*`-Pipelines:

- Ein Push auf `dev` startet [fd-ci.yml](../.github/workflows/fd-ci.yml) (Lint, Format, Vale,
  3D-Smoke-Test, e2e). Ein erfolgreicher Lauf auf `dev` stößt
  [fd-deploy-dev.yml](../.github/workflows/fd-deploy-dev.yml) an: HomeNet-Deployment über den Tag
  `fd` plus Pre-Release `dev-v<version>`.
- `main` wird nicht per Push aktualisiert. Der Weg in die Produktion führt über
  [fd-promote-prd.yml](../.github/workflows/fd-promote-prd.yml) (manuell per `workflow_dispatch`).
  Der Workflow prüft Version und `CHANGELOG.md`, merged `dev` → `main` und stößt
  [fd-deploy-prd.yml](../.github/workflows/fd-deploy-prd.yml) an. Dieser Produktionspfad hat ein
  eigenes CI-Gate, deployt GitHub Pages und setzt erst danach Tag und Release.

Typischer Ablauf für eine Änderung:

```bash
# 1. Issue-Branch, Worktree und Draft-PR gegen dev
npm run start-work -- IS_123

# 2. Nach Review: Squash-Merge des Issue-Branches in dev und Push
git push origin dev

# 3. fd-ci läuft auf dev, danach deployt fd-deploy-dev automatisch

# 4. Produktion: Versionsbump, Push auf dev, dann Promote auslösen
npm run versionbump
git commit -am "chore(release): bump version" && git push origin dev
gh workflow run fd-promote-prd.yml
```

Ein Promote ohne neue Version ist ein No-Op: `fd-deploy-prd` erkennt, dass `main` bereits dem
letzten stabilen Release entspricht, und beendet sich grün.

Weitere Details finden sich in der [Feature-Dokumentation](./features/fr006-autodeploy.md).

## 🧾 Siehe auch

[Astro Documentation](https://docs.astro.build) – Die offizielle Dokumentation zu Astro. Wenn bei
einem Astro-Thema Unklarheiten bestehen, findet sich dort in der Regel eine präzise Erklärung.

Die
[Customizing-Anleitung von astrogon](https://github.com/astrogon/astrogon/blob/main/docs/customization.md)
beschreibt, wie das Theme angepasst werden kann.

Weitere Details zum zugrunde liegenden Stack bietet
[Tech Stack](https://github.com/astrogon/astrogon/blob/main/docs/tech-stack.md).
