---
agent: 'agent'
description: 'Automate the process of podcast updates'
model: Auto (copilot)
---

# Allgemeine Infos

Unter aboutme/doag habe ich alle Folgen gelistet, die von meinem Podcast bisher erschienen sind.
Jeden Dienstag erscheint eine neue Folge, die automatisch in meinen Blog eingebunden werden soll.

Alle Folgen können unter https://feeds.acast.com/public/shows/doag-voices-arbeitstitel abgerufen
werden.

Die Einbindung neuer Folgen soll über einen github action worflow erfolgen. Dieser Workflow soll
immer Dienstag morgen um 9 Uhr und bei Bedarf nach manuellemn Aufruf laufen.

Der Action Runner läuft auf einer OnPrem Maschine. Nutze runs-on: [self-hosted, frickeldave-main] um
den GitHub Action Runner anzusprechen.

Der Workflow soll folgende Dinge durchführen:

## GitHub Worflow - Informationen sammeln

Der erste Teil des GitHub Workflows soll Informationen sammeln.

- Prüfe nach ob die GitHub CLI verfügbar ist. Wenn nein, brich mit Fehler ab.
- Checkout von https://github.com/Frickeldave/frickeldave.github.io
- Vergleiche, welche Folgen im Repo unter src\content\aboutme\doag.md noch fehlen und gib aus,
  welche noch fehlen.
- Sind keine Folgen auf acast vorhanden die hier noch fehlen, beende mit Erfolgt und entsprechender
  Ausgabemeldung.
- Ist mehr als eine Folge auf acast vorhanden die noch nicht auf dieser Website gelistet,
  identifiziere die älteste der fehlenden Folgen.
- Nun setze über GitHub Copilot CLI einen Prompt ab, der den gesamten Inhalt der Podcast Folge mit
  einem prompt absetzt, der die folgenden Infos abfragt und als reines JSON Textformat zurückgibt.
  - Erstelle einen Titel der fehlenden Folge in dem Stil wie es schon unter
    src\content\aboutme\doag.md für andere Folgen umgesetzt wurde.
  - Erstelle eine Zusammenfassung der fehlenden Folge in dem Stil wie es schon unter
    src\content\aboutme\doag.md für andere Folgen umgesetzt wurde.
  - Identifiziere das Datum, wann die Folge erschienen ist.
  - Identifiziere die Kategorie.
  - Identifiziere die Teilnehmer.
  - Finde den Deeplink zum Amazon Music, Spotify und Apple Music zu der Folge. Wenn der Link nicht
    identifizierbar ist, verwende die show links:
    - https://open.spotify.com/show/5U7lAyly41FMj6IM7OE4OB
    - https://podcasts.apple.com/de/podcast/doag-voices/id1847181531
    - https://music.amazon.de/podcasts/5d145588-d877-467e-b3b2-bf3da6bf28cd/doag-voices

## Umsetzung

Der zweite Teil des GitHub Workflows setzt die Informationen um und erzeugt einen neuen Eintrag.

- Erstelle einen GitHub Issue mit dem Titel "Podcast Update: <TITEL>" unter
  https://github.com/Frickeldave/frickeldave.github.io mit dem label "podcast-update".
- Erstelle aus dem main-branch heraus einen neuen branch mit dem Namen
  "podcast-update*yyyymmdd-hhmmss*<TITLE>"
- Erstelle eine 5-stellige id die in src\content\aboutme\doag.md noch nicht vorkommt.
- Erstelle eine neue Folge in src\content\aboutme\doag.md mit id (doag-voices-xxxxx), Bild, Titel,
  Kategorie, Datum, Links zu Spotify, Apple Music und Amazon Music, Teilnehmern, Beschreibung und
  Player Controls, wie es auch schon für andere Folgen umgesetzt ist.
- Verlinke das Bild src\assets\doagvoices\doag-voices-placeholder.png.
- Füge die Änderungen zu git hinzu
- Committe die Änderungen
- Pushe den Branch
- Erstelle eine PullRequest mit dem Titel "Podcast Update: DEV <TITEL>" der der Änderungen von
  "podcast-update*yyyymmdd-hhmmss*<TITLE>" nach "dev" merged.
- Warte ab, bis alle PR Checks grün sind.
- Merge den PR in den "dev" Branch und lösche den Branch "podcast-update*yyyymmdd-hhmmss*<TITLE>"
- Ist kein Merge möglich (Weil die PR-Checks rot sind oder Merge Konflikte bestehen) brich mit
  Fehler ab.
- Erstelle eine PullRequest mit dem Titel "Podcast Update: PRD <TITEL>" der der Änderungen von "dev"
  nach "main" merged.
- Warte ab, bis alle PR Checks grün sind.
- Merge den PR in den "main" Branch
- Ist kein Merge möglich (Weil die PR-Checks rot sind oder Merge Konflikte bestehen) brich mit
  Fehler ab.
- Beende den Workflow mit einer Erfolgsmeldung und einer Übersicht der Dinge die gemacht wurden.
