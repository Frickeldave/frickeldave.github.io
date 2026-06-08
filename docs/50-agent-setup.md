---
title: "Agent-Setup: Requirement Engineer Gatekeeping"
description:
  "Dokumentation des RE-Gatekeeping-Systems: Hooks, Instructions, Approval-Workflow und
  PreToolUse-Hook. Nützlich für die Einrichtung in eigenen Projekten."
pubDate: 2026-06-08
tags: [setup, agent, automation, process, github]
categories: [architecture]
---

# Requirement Engineer Gatekeeping — Setup & Dokumentation

Dieses Dokument beschreibt das Requirement Engineer (RE) Gatekeeping-System des
`frickeldave.github.io`-Projekts. Es ist so aufgebaut, dass es in anderen Projekten nachgebaut
werden kann.

## Warum existiert der RE-Agent?

Bei der Arbeit mit KI-Assistenten (GitHub Copilot, Cursor, etc.) besteht das Risiko, dass Code- oder
Datei-Änderungen ungeprüft vorgenommen werden. Das RE-Gatekeeping-System schafft eine
Sicherheitsstufe:

1. **Jede** geplante Änderung wird zuerst vom Requirement Engineer Agent geprüft
2. Änderungen werden als GitHub Issue erfasst und mit dem User überarbeitet
3. **Keine** Code-Änderung ohne explizite Freigabe des RE-Agenten
4. Der PreToolUse-Hook verhindert technische Umgehung

## System-Architektur

```
┌─────────────────────────────────────────────────┐
│  User (Developer)                               │
│  · Vorschlag für Änderung                       │
│  · Antwort auf RE-Fragen                        │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Requirement Engineer Agent                     │
│  (.github/agents/requirement-engineer.agent.md) │
│  · Prüft Änderungsvorschläge                    │
│  · Erstellt/überarbeitet Tickets                │
│  · Gibt erst frei, wenn alles klar ist          │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  GitHub MCP Server                              │
│  · Issue erstellen / lesen                      │
│  · Labels verwalten                             │
│  · Pull Requests                                │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  PreToolUse Hook                                │
│  (.github/hooks/validate-code-change.mjs)       │
│  · Prüft .github/hooks/approvals/current        │
│  · Erlaubt/blockiert File-Edit-Operationen      │
│  · Erlaubt/blockiert Browser-Investigations     │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  File System                                    │
│  · src/ (Code)                                  │
│  · src/content/ (Content)                       │
│  · config files                                 │
└─────────────────────────────────────────────────┘
```

## Komponenten im Detail

### 1. Requirement Engineer Agent

Der RE-Agent ist unter `.github/agents/requirement-engineer.agent.md` definiert. Er ist der
Gatekeeper für jede Änderung und darf selbst KEINE Dateien bearbeiten.

**Rolle:**

- Anforderungen verstehen und dokumentieren
- GitHub Issues erstellen und überarbeiten
- Auf Freigabe warten, bevor Implementierung erlaubt wird
- Qualität sichern (vollständig, konsistent, konventionskonform)

**Wichtig:** Der RE-Agent darf NIEMALS `create_file`, `replace_string_in_file` oder ähnliche
Operationen direkt ausführen.

### 2. PreToolUse Hook

Der PreToolUse-Hook ist die technische Sicherheitsebene. Er wird VOR jeder File-Edit-Operation
ausgeführt und prüft, ob ein gültiges Approval existiert.

**Dateien:**

- `.github/hooks/validate-code-change.mjs` — Node.js-Skript (plattformübergreifend)
- `.github/hooks/validate-code-change.json` — Hook-Konfiguration
- `.github/hooks/approvals/current` — Approval-File (wird vom RE-Agent erstellt)

**Geblockte Tool-Kategorien:**

| Kategorie              | Tools                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| File-Edit-Operationen  | `replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, `edit_notebook_file`, `delete_file` |
| Browser-Investigations | `navigate_page`, `open_browser_page`, `screenshot_page`, `read_page`                                         |

Durch das Blockieren der Browser-Investigationstools wird verhindert, dass das LLM ohne Approval
überhaupt mit der Analyse eines Problems beginnt — nicht erst wenn es Dateien ändern will.

**Verhalten:**

| Situation                            | Entscheidung                         |
| ------------------------------------ | ------------------------------------ |
| Kein Approval-File                   | `deny` — Mit blockierender Nachricht |
| Approval ohne Issue-Referenz         | `deny` — Mit Warnung                 |
| Approval abgelaufen                  | `deny` — Mit Hinweis auf Erneuerung  |
| Approval mit gültigem Issue (GH-XXX) | `allow` — Alle Operationen erlaubt   |

### 3. copilot-instructions.md

Die Datei `.github/copilot-instructions.md` definiert die Trigger-Liste, die bestimmt, wann ein
REQ-Approval erforderlich ist.

**Trigger-Kategorien:**

- Refactoring
- Testing
- Config
- Dependencies
- Deployment
- Process (einschließlich RE-Gatekeeping-System selbst)
- Content-Changes (mit Ausnahme für Multi-Prompt Markdown-Verarbeitung)

### 4. GitHub Issue als Ticket

Alle Änderungen werden als GitHub Issue erfasst. Das garantiert:

- Nachvollziehbarkeit jeder Änderung
- Diskussion und Iteration vor der Implementierung
- Verknüpfung mit Pull Requests
- Automatisches Tracking via GitHub API

## Workflow im Detail

```
1. User schlägt Änderung vor
         │
         ▼
2. Prompt-Instructions prüfen Trigger-Liste
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Trigger?   Nein
    │         │
    ▼         ▼
3. RE-Agent  4. Direkt
   prüft     implementieren
   Vorschlag
    │
    ▼
5. Offene Fragen
   klären
    │
    ▼
6. GitHub Issue
   erstellen
   (#251)
    │
    ▼
7. RE-Agent
   freigegeben?
    │     │
    │     ▼
    │   ❌ Blockiert
    │     mit Begründung
    │
    ▼
8. ✅ Freigegeben
    │
    ▼
9. RE-Agent erstellt
   Approval-File
    │
    ▼
10. PreToolUse Hook
    erlaubt File-Edits
    │
    ▼
11. Implementierung
```

## Multi-Prompt Markdown-Verarbeitung

Für längere Dokumentationen oder Blog-Posts gilt eine Besonderheit:

Der User arbeitet oft über mehrere Prompts hinweg an einem Dokument. In diesem Fall:

1. Der User sagt explizit, dass er an einem Dokument arbeitet
2. Copilot DARF File-Edit-Operationen für Markdown/MDX-Dateien OHNE REQ-Approval durchführen
3. Diese Ausnahme gilt NICHT für:
   - Neue, völlig neue Seiten/Sections
   - Änderungen an existing Templates/Komponenten
   - Änderungen an bestehenden Docs ohne expliziten Fortsetzungskontext

## Nachbau in eigenen Projekten

### Schritt-für-Schritt

1. **RE-Agent erstellen**: Kopiere `.github/agents/requirement-engineer.agent.md` in dein Projekt
2. **PreToolUse-Hook einrichten**: Kopiere `.github/hooks/validate-code-change.mjs` und
   `.github/hooks/validate-code-change.json`
3. **Approval-Verzeichnis erstellen**: `.github/hooks/approvals/` mit README.md
4. **copilot-instructions.md erstellen**: `.github/copilot-instructions.md` mit deinen
   Trigger-Regeln
5. **Doku erstellen**: `.github/hooks/approvals/README.md` mit deinem Workflow

### Voraussetzungen

- GitHub Copilot mit Agent-Support
- GitHub MCP Server konfiguriert
- Node.js für den PreToolUse-Hook

## FAQ

**Q: Was passiert, wenn der Hook fehlt?** A: Die Prompt-Instructions sind die erste
Verteidigungslinie. Ohne Hook kann der LLM ungeprüft editieren — aber das RE-Agent-System sagt ihm
explizit, dass er es NICHT tun darf.

**Q: Kann der Hook umgangen werden?** A: Nur durch manuelles Editieren von Dateien außerhalb von
Copilot. Der Hook blockiert alle File-Edit-Operationen und Browser-Investigationstools innerhalb von
Copilot. Ein LLM kann also ohne Approval weder Dateien ändern noch eine Seite im Browser öffnen oder
untersuchen.

**Q: Was, wenn ich eine sofortige Änderung brauche?** A: Der Workflow kann beschleunigt werden — der
RE-Agent erstellt schnell ein Issue und gibt es frei. Das Approval-File wird erstellt, und die
Implementierung kann sofort starten.
