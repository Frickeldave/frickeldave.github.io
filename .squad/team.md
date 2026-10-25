# Squad-Team

> frickeldave.github.io

## Koordinator

| Name | Rolle | Hinweise |
|------|------|-------|
| Squad | Koordinator | Routet Arbeit, erzwingt Übergaben und Reviewer-Gates. |

## Mitglieder

| Name | Rolle | Charter | Status |
|------|------|---------|--------|
| Tony | Lead & Requirement Gatekeeper | `.squad/agents/tony/charter.md` | ✅ Aktiv |
| Pepper | Requirement Engineering / Anforderungsspezialistin | `.squad/agents/pepper/charter.md` | ✅ Aktiv |
| Bruce | Backend / Scripts / Komponenten | `.squad/agents/bruce/charter.md` | ✅ Aktiv |
| Natasha | Frontend-Entwickler / UI-Spezialist | `.squad/agents/natasha/charter.md` | ✅ Aktiv |
| Clint | Tester / QA-Spezialist | `.squad/agents/clint/charter.md` | ✅ Aktiv |
| Maria | Technische Redakteurin / Dokumentationsspezialistin | `.squad/agents/maria/charter.md` | ✅ Aktiv |
| Nick | DevOps / Infrastructure-Spezialist | `.squad/agents/nick/charter.md` | ✅ Aktiv |
| Jennifer | Rechtliche Compliance / Editorial Governance-Spezialistin | `.squad/agents/jennifer/charter.md` | ✅ Aktiv |
| Scribe | Session-Logger | `.squad/agents/scribe/charter.md` | 📋 Stumm |
| Ralph | Work-Monitor | `.squad/agents/ralph/charter.md` | 🔄 Monitor |
| Rai | RAI-Reviewer | `.squad/agents/Rai/charter.md` | 🛡️ RAI |

## Menschliche Mitglieder

| Name | Spitznamen | Rolle | Sprache | Badge | GitHub | E-Mail |
|------|-----------|-------|---------|-------|--------|--------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human | Frickeldave | dave@frickeldave.de |

### Dev-Container für menschliche Mitglieder

Der Workflow `fd-bootstrap` legt für **jedes menschliche Mitglied mit einem GitHub-Handle** in der Spalte `GitHub` genau einen Dev-Container an (`fd-dev-<handle-slug>`, ein StatefulSet plus Service im Namespace `fd-infra`). Das Handle ist die einzige Pflichtangabe; die Rolle entscheidet, ob ein Container entsteht — `Developer`/`Techlead` bekommen einen, Projektleitung nicht.

Der SSH-Zugang ist optional. Ein öffentlicher Schlüssel gehört in die Tabelle `## Developer SSH Keys` (`GitHub`-Handle plus `SSH Public Key`; nur öffentliche Schlüssel, niemals private), der Vergleich läuft case-insensitive über das Handle. Liegt ein Schlüssel vor, startet der Container `sshd` auf Port `2222` und legt den Schlüssel als `authorized_keys` ab; fehlt ein Schlüssel (aktueller Stand: für David Koenig ist hier kein Schlüssel hinterlegt), wird der Container trotzdem angelegt, `sshd` und `authorized_keys` bleiben aus, und der Zugang erfolgt ausschließlich über `kubectl exec`:

```bash
kubectl -n fd-infra exec -it fd-dev-frickeldave-0 -c dev -- bash
```

Der Schlüssel wird beim Anlegen über die Umgebungsvariable `FD_SSH_PUBLIC_KEY` übergeben (kein Volume, kein Kubernetes-Secret). Ein später eingetragener Schlüssel greift erst nach einem bewussten Neustart des Containers (`restart_machines` mit Datenverlust-Warnung), weil die StatefulSets `updateStrategy: OnDelete` verwenden und laufende Container nie automatisch neu starten.

## Developer SSH Keys

| GitHub | SSH Public Key |
|--------|----------------|

## Projektkontext

- **Projekt:** frickeldave.github.io
- **Owner:** David Koenig
- **Stack:** Astro 7, TypeScript, Tailwind CSS 4, Cloudflare/GitHub Pages
- **Beschreibung:** Persönliche Website mit Blog, Docs, handmade, Recipes und Portfolio-Content.
- **Erstellt:** 2026-06-30
