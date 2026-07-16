# Nutzung

Dieses Dokument beschreibt, wie das Projekt `frickeldave.de` nach der Einrichtung lokal genutzt
und betrieben wird.

## 🧞 Befehle (Astro)

Alle Befehle werden im Terminal aus dem Projektwurzelverzeichnis ausgefuehrt:

| Befehl                  | Aktion                                                            |
| :---------------------- | :---------------------------------------------------------------- |
| `npm install`           | Installiert Abhaengigkeiten und fuehrt den `postinstall`-Hook aus |
| `npm run dev`           | Startet den lokalen Entwicklungsserver unter `localhost:4321`     |
| `npm run build`         | Baut die Produktionsversion der Website nach `./dist/`            |
| `npm run format`        | Formatiert Dateien in `src/` mit Prettier                         |
| `npm run format:check`  | Prueft die Formatierung in `src/`, ohne Dateien zu aendern        |
| `npm run lint`          | Fuehrt ESLint auf `src/` mit Auto-Fix aus                         |
| `npm run lint:check`    | Fuehrt ESLint auf `src/` ohne Auto-Fix aus                        |
| `npm run prose-install` | Installiert die lokale Vale-Binaerdatei nach `.vale/`             |
| `npm run prose`         | Fuehrt Vale gegen `src/content` aus                               |
| `npx astro -- --help`   | Zeigt die Hilfe der Astro-CLI an                                  |
| `npx astro add <pkg>`   | Fuegt eine Astro-Integration hinzu                                |

Weitere Details zum automatisierten Deployment stehen in
[FR006: Automated Dev Deployment](./features/fr006-autodeploy.md).

## 🚀 Automatisches Deployment

Dieses Repository verwendet nicht mehr `npm run deploy:dev` oder `npm run deploy:prd`.

Der aktuelle Deployment-Ablauf ist branch-basiert:

- Pushes auf `dev` starten [.github/workflows/deploy-dev.yml](../.github/workflows/deploy-dev.yml).
- Pushes auf `main` starten [.github/workflows/deploy-prd.yml](../.github/workflows/deploy-prd.yml).
- Die VS-Code-Task [Deploy to Main](../.vscode/tasks.json) merged `dev` lokal nach `main` und
  pusht das Ergebnis.
- Fuer einen interaktiven, GitHub-basierten Merge-Ablauf steht
  [scripts/merge-branches.mjs](../scripts/merge-branches.mjs) zur Verfuegung.

Typischer lokaler Ablauf:

```bash
git checkout dev
git push origin dev

# nach der Verifikation
git checkout main
git pull origin main
git merge dev --no-ff -m "Deploy dev to main"
git push origin main
git checkout dev
```

Weitere Details finden sich in der [Feature-Dokumentation](./features/fr006-autodeploy.md).

## 🧾 Siehe auch

[Astro Documentation](https://docs.astro.build) - Die offizielle Dokumentation zu Astro. Wenn bei
einem Astro-Thema Unklarheiten bestehen, findet sich dort in der Regel eine praezise Erklaerung.

Die
[Customizing-Anleitung von astrogon](https://github.com/astrogon/astrogon/blob/main/docs/customization.md)
beschreibt, wie das Theme angepasst werden kann.

Weitere Details zum zugrunde liegenden Stack bietet
[Tech Stack](https://github.com/astrogon/astrogon/blob/main/docs/tech-stack.md).
