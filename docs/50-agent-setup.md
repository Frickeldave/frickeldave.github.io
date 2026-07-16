---
title: "Squad-Agent-Setup"
description: "Überblick über das aktive Squad-basierte Agentenmodell in diesem Repository, inklusive Rollen, Routing, Issue-Gate und Maintainer-Kontaktpunkten."
pubDate: 2026-07-01
tags: [setup, squad, agents, workflow, github]
categories: [architecture]
---

# Squad-Agent-Setup

Dieses Repository nutzt Squad als repo-lokales Betriebsmodell für KI-gestützte Arbeit. Squad ist
keine generische Chat-Schicht. Gemeint ist die Kombination aus Teamdefinitionen, Routing-Regeln,
Issue-Gates und Automatisierung, die Änderungen an eine echte Aufgabe bindet, sie der richtigen
Fachrolle zuordnet und vor dem Abschluss nachvollziehbar validiert.

Praktisch existiert Squad hier, weil dieses Repo Produktcode, Inhalte, Dokumentation, Skripte,
Workflows und Deployment-Logik kombiniert. Ein leichtgewichtiges Rollenmodell macht das sicherer
und wartbarer: Dieselbe Anfrage kann unterschiedlich geroutet werden, je nachdem ob sie Astro-UI,
CI, Dokumentation, Tests oder Governance betrifft.

## Was Squad Hier Bedeutet

In diesem Repository wird Squad durch eine kleine Menge repo-lokaler Artefakte definiert:

- `.squad/team.md` für das aktive Team und die Rollenbeschreibungen
- `.squad/routing.md` für Issue-Gate, Routing-Regeln und Eskalation
- `.squad/agents/` für die rollenspezifischen Charter
- `.github/agents/squad.agent.md` für das Verhalten des Koordinators
- `.github/workflows/` für GitHub-seitiges Routing und Label-Automatisierung

Dieses Modell soll vier Dinge konsistent leisten:

1. Implementierung an ein GitHub-Issue binden statt an einen nicht nachverfolgbaren Prompt
2. Arbeit an eine benannte Zuständigkeit mit klarem Fachbereich routen
3. Dateiedits verhindern, bevor das Issue in einem erlaubten Zustand ist und explizit freigegeben wurde
4. belastbare Spuren in repo-lokalen Dokumenten hinterlassen statt sich auf Chat-Historie zu verlassen

## Aktuelles Rollenmodell

Die aktive Besetzung steht in `.squad/team.md`. Die unten genannten Rollen sind das aktuelle
Arbeitsmodell und keine Beispiele.

### Squad-Koordinator

`Squad` ist der Koordinator. Diese Rolle besitzt keinen eigenen technischen Fachbereich. Ihre Aufgabe
ist die Orchestrierung: Anfrage lesen, Zuständigkeit festlegen, die Routing-Regeln durchsetzen und
sicherstellen, dass das erforderliche Gate erfüllt ist, bevor die Umsetzung beginnt.

### Tony

Tony verantwortet Triage, Scope-Entscheidungen und die finale Freigabe für Arbeit, die zur Umsetzung
bereit ist. Tony ist der Eskalationspunkt, wenn Routing unklar ist, eine Aufgabe mehrere Domänen
schneidet oder der Issue-Status die Implementierung nicht sauber trägt.

### Bruce

Bruce verantwortet backend-nahe Arbeit in diesem Repo: Services, Skripte, Integrationen und
Implementierung in unterstützender Logik wie `src/lib/**` und `scripts/**`.

### Natasha

Natasha verantwortet Frontend- und UI-Arbeit: Astro-Seiten und -Komponenten, Tailwind-getriebene
Präsentation sowie Änderungen am Designsystem, die beeinflussen, wie sich die Site im Browser zeigt
oder verhält.

### Clint

Clint verantwortet Testing und QA. Dazu gehören gezielte Validierung, Regressionsabdeckung und
Release-Readiness-Prüfungen für Änderungen, die stärkere Verifikation brauchen, bevor sie als sicher
gelten können.

### Maria

Maria verantwortet technische Dokumentation und maintainer-orientierte schriftliche Leitlinien.
Änderungen in `docs/**` routen normalerweise hierher, sofern sie nicht eng an die Domäne einer
anderen Fachrolle gekoppelt sind.

### Nick

Nick verantwortet DevOps- und Infrastrukturthemen: GitHub-Workflows, Deployment-Pfade,
Automatisierung, umgebungssensitive Änderungen und operatives Hardening.

### Jennifer

Jennifer verantwortet Legal Compliance und redaktionelle Governance. Dazu gehören policy-sensitive
Inhalte, redaktionelle Struktur und Prüfungen, bei denen Rechts- oder Governance-Bewertung wichtiger
ist als Implementierungsdetail.

### Scribe

Scribe ist der Sitzungslogger. Diese Rolle erfasst belastbare Ergebnisse wie Entscheidungen,
relevanten Kontext und sessionübergreifende Breadcrumbs, damit der Prozess nicht von einem
flüchtigen Chat abhängt.

### Ralph

Ralph ist der Arbeitsmonitor. Ralph verfolgt Kontinuität, markiert stockende Arbeit und hilft dem
Team, aktive Aufgaben über Sessions hinweg sichtbar zu halten.

### Rai

Rai ist der Responsible-AI-Reviewer. Rai ist der explizite Kontrollpunkt für sicherheitssensible
Änderungen oder Review-Themen, die vor Release oder Übernahme eine dedizierte RAI-Perspektive
benötigen.

## Issue- und Routing-Gate

Das Gate ist in `.squad/routing.md` definiert. Grundsätzlich startet hier keine Inhalts- oder
Code-Arbeit nur deshalb, weil jemand danach gefragt hat. Die Anfrage muss an ein gültiges GitHub-Issue
gebunden sein und die lokalen Aktivierungsprüfungen bestehen.

Vor der ersten Dateiveränderung erwartet Squad alle folgenden Punkte:

1. Es existiert ein offenes GitHub-Issue.
2. Das Issue trägt das Label `squad`.
3. Der Issue-Status ist exakt `Ready to implement` oder `In progress`.
4. Tony hat genau dieses Issue explizit freigegeben.
5. Der Nutzer hat bestätigt, dass genau an diesem Issue gearbeitet wird.
6. Der lokale Marker `.frickeldave-active-issue` wurde für diese Aufgabe angelegt oder aktualisiert.

Fehlt eine dieser Bedingungen, stoppt die Implementierung. Die einzige Ausnahme ist reine
Issue-Metadatenpflege, die ohne Freischaltung von Dateiedits stattfinden kann.

Das Routing präzisiert die Zuständigkeit anschließend mit `squad:<member>`-Labels. Das Basislabel
`squad` bedeutet, dass das Issue im Squad-Scope liegt. Das Member-Label bedeutet, dass das Issue an
eine wahrscheinliche Zuständigkeit geroutet wurde, etwa `squad:natasha`, `squad:maria` oder
`squad:nick`.

Die Datei `.frickeldave-active-issue` ist der lokale Aktivierungsmarker. Sie ist der Nachweis auf
Session-Ebene, dass das freigegebene Issue aktuell Änderungen auslösen darf. Die erforderliche
YAML-Struktur ist in `.squad/routing.md` dokumentiert.

## Verbindliche Referenzen

Diese Dateien sind die operative Referenz für das aktuelle Modell.

- `.squad/team.md`: kanonische Teamliste, Rollennamen und aktueller Projektkontext
- `.squad/routing.md`: Gate-Regeln, Routing-Tabelle, Labels, Lifecycle und Eskalationspfad
- `.github/agents/squad.agent.md`: Koordinator-Anweisungen für das Verhalten von Squad in einer Session
- `.squad/agents/<name>/charter.md`: detaillierte Rollenbeschreibung pro Rolle
- `.squad/decisions.md`: belastbares Protokoll wichtiger Entscheidungen
- `.squad/ceremonies.md`: wiederkehrende Koordinationsmuster, wenn das Team explizite Review-Schleifen braucht
- `.github/workflows/squad-triage.yml`: reagiert auf das Label `squad` und ergänzt initiales Routing
- `.github/workflows/squad-issue-assign.yml`: reagiert auf `squad:*`-Labels und veröffentlicht Zuweisungshinweise
- `.github/workflows/squad-heartbeat.yml`: Workflow für operative Kontinuität des Squad-Systems
- `.github/workflows/sync-squad-labels.yml`: hält Repository-Labels mit dem Team-Setup synchron
- `.github/ISSUE_TEMPLATE/`: Eingabevorlagen für Bug-, Feature-, Content- und Dokumentationsarbeit
- `docs/40-arch-architecture-decisions.md`: breiterer Architekturkontext, wenn eine Aufgabe von Systementscheidungen abhängt

Wenn du nur zwei Dateien liest, um den Prozess zu verstehen, dann zuerst `.squad/team.md` und
`.squad/routing.md`.

## Typischer Aufgabenfluss

Eine normale Squad-Aufgabe bewegt sich in diesem Repository so durch den Prozess.

### 1. Eingang

Eine Nutzeranfrage wird einem bestehenden GitHub-Issue zugeordnet oder über das passende Template in
`.github/ISSUE_TEMPLATE/` in eines überführt. Squad-Arbeit sollte von einem Issue ausgehen, nicht nur
von einer freien Anfrage.

### 2. Triage und Routing

Das Issue erhält das Label `squad`. GitHub-seitige Automatisierung und die Routing-Regeln grenzen
anschließend die wahrscheinliche Zuständigkeit ein. Eine Doku-Anfrage landet typischerweise bei
Maria, eine UI-Anfrage bei Natasha, ein Workflow- oder Deployment-Thema bei Nick und testlastige
Nacharbeit bei Clint.

### 3. Gate-Check

Vor jedem Edit prüft die Session die erlaubten Statuswerte, das Label `squad`, Tonys Freigabe, die
Bestätigung des Nutzers und den Marker `.frickeldave-active-issue`. Das ist der harte Stopp zwischen
Triage und Implementierung.

### 4. Implementierung

Die zuständige Fachrolle setzt den kleinsten in Scope liegenden Änderungssatz um, der für das aktive
Issue nötig ist. Wenn sich die Arbeit über mehrere Domänen ausweitet, zieht Squad die zusätzliche
Fachrolle hinzu und eskaliert an Tony, sobald Scope oder Ownership unklar werden.

### 5. Validierung

Die Validierung sollte so schmal und relevant wie möglich ausfallen: Tests für Verhalten, Linting
für Codequalität, Prosa-Checks für Dokumentation oder Workflow-Review für Automatisierung. Routing
ersetzt keine Verifikation.

### 6. Protokollierung und Abschluss

Das Ergebnis wird bei Bedarf in die operativen Unterlagen des Repos zurückgeschrieben: als
Issue-Update, in `.squad/decisions.md` und über Session-Logging durch Scribe, wenn die Arbeit eine
belastbare Entscheidung oder nützlichen Kontext für die nächste Session erzeugt hat.

## Hinweise für Maintainer

Wenn sich der Workflow ändert, aktualisiere die Prozessdokumentation als zusammengehörenden Satz und
nicht Datei für Datei isoliert.

Wenn sich die Teambesetzung ändert, aktualisiere `.squad/team.md`, das passende Charter unter
`.squad/agents/` und alle betroffenen Routing-Regeln in `.squad/routing.md`.

Wenn sich das Issue-Gate ändert, aktualisiere zuerst `.squad/routing.md` und prüfe danach, ob das
Verhalten in `.github/agents/squad.agent.md` und `.github/workflows/` noch zu den dokumentierten
Regeln passt.

Wenn sich das Label-Verhalten ändert, prüfe `.github/workflows/squad-triage.yml`,
`.github/workflows/squad-issue-assign.yml` und `.github/workflows/sync-squad-labels.yml` gemeinsam.
Diese Dateien setzen die praktische Seite des Routing-Modells um.

Wenn du änderst, wie Maintainer Squad verwenden sollen, aktualisiere dieses Dokument zuletzt, damit
es eine präzise Übersicht des Live-Prozesses bleibt und keine spekulative Design-Notiz wird.

Eine kurze historische Notiz: Ältere Entwürfe können strengere oder anders benannte Zuständigkeits-Ebenen
beschreiben. Die aktuelle verbindliche Referenz dieses Repositories ist jedoch die oben aufgeführte aktive
Konfiguration unter `.squad/` und `.github/`.

### Wenn sich Routing oder Gate ändern

Aktualisieren:

- zuerst `.squad/routing.md`, weil dort der primäre Verhaltensvertrag definiert ist
- `.github/workflows/squad-triage.yml`, wenn sich Label- oder Routing-Logik geändert hat
- `.github/workflows/squad-issue-assign.yml`, wenn sich das Zuweisungsverhalten geändert hat
- die Issue-Templates in `.github/ISSUE_TEMPLATE/`, wenn sich die Erwartungen an den Eingang geändert haben

Halte die Anforderungen an das aktive Issue und die dokumentierte Status-Whitelist mit dem realen
Verhalten synchron.

### Wenn sich Prüfung oder Governance ändern

Aktualisieren:

- die relevante Agenten-Rollenbeschreibung
- `.squad/ceremonies.md`, wenn sich ein Koordinations-Checkpoint geändert hat
- `.squad/decisions.md`, wenn die Änderung eine belastbare Projektentscheidung ist
- Dokumente in `docs/`, die den Prozess für Beitragende und Maintainer erklären

### Regel für die Dokumentationspflege

Behandle diese Seite als Übersicht, nicht als einzige verbindliche Referenz. Die operative Referenz
liegt in den Squad-Dateien und Workflows. Wenn sich Prozessverhalten ändert, aktualisiere zuerst
diese Dateien und frische dann dieses Dokument auf, damit es ein präziser Leitfaden für neue
Mitwirkende bleibt.

## Zusammenfassung

Squad ist in diesem Repository ein repo-lokales Workflow-System für KI-gestützte Arbeit. Es verbindet
benannte Rollen, GitHub-Issue-Routing, ein striktes Tony-Freigabe-Gate und einen einfachen
Aktiv-Issue-Marker, damit Änderungen kontrolliert und prüfbar bleiben. Für Maintainer ist
entscheidend, Team-, Routing-, Workflow- und Dokumentationsdateien gemeinsam zu aktualisieren, damit
die beschriebene Dokumentation weiterhin dem Live-Prozess entspricht.
