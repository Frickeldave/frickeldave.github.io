---
name: "tmux-session-management"
description: "Wiederverwendbare tmux-Anleitung fuer issue-/PR-bezogene Squad-Arbeit in Terminal-Sessions"
allowedTools: []
confidence: "high"
domain: "workflow, tmux, terminal-operations"
source: "abgeleitet aus scripts/start-work.mjs, scripts/start-reqeng.mjs, scripts/start-review.mjs und .squad/templates/worktree-reference.md"
---

# Skill: tmux-session-management

## Zweck

Verwende diesen Skill, um issue- oder PR-bezogene Squad-Arbeit in einen reproduzierbaren lokalen Kontext zu bringen: zuerst die kanonische Issue-/PR-Identitaet klaeren, dann tmux korrekt gegen diese Identitaet pruefen, danach den passenden Worktree wiederverwenden oder anlegen und erst anschliessend arbeiten.

## Verwende diesen Skill, wenn

- issue- oder PR-bezogene lokale Arbeit vorbereitet wird, auch wenn tmux gar nicht installiert ist
- Implementierungsarbeit bewusst aus einer tmux-Session gestartet wird
- Review-Fix-Arbeit zuerst die Ausrichtung von tmux, Worktree und Issue pruefen muss
- ein Prompt oder Operator eine stabile Benennungsregel fuer tmux-Sessions, Fenster und Panes benoetigt
- mehrere Terminalprozesse an einem issue-spezifischen Workflow-Kontext angeheftet bleiben muessen

## Verwende diesen Skill nicht als

- Ersatz fuer `.squad/routing.md`, `.squad/decisions.md` oder `scripts/README.md`
- Umgehung von GitHub-Issue-Gates oder der Freigabe
- verpflichtende Voraussetzung fuer jeden Workflow im Repository
- CI/CD-, Deployment-, Container- oder Orchestrierungsframework
- Anweisung, Secrets offenzulegen — fuer Namensschema und Worktree-Matching ist `.github/skills/worktree-naming-conventions/SKILL.md` zustaendig

## Sitzungsmodell

### Sitzungsbenennung

- Das kanonische Namensschema fuer Session und Worktree wird **nicht** in diesem Skill definiert, sondern in `.github/skills/worktree-naming-conventions/SKILL.md`.
- Fuer tmux ist nur relevant: der Session-Name muss **exakt** dem verkuerzten Ref-Namen entsprechen, also `IS<n>` oder `PR<n>`.
- Es gibt in diesem Repository kein kombiniertes Pflichtschema wie `<ISSUEID>_PR-<PRID>_<BESCHREIBUNG>`.
- Liegt nur eine `pr_id` vor, darf der Zielkontext direkt als `PR_<id>` gefuehrt werden; ein verlinktes Issue ist fuer die tmux-Namensvalidierung nicht erforderlich.
- Existieren mehrere moegliche Issues/PRs oder gar kein eindeutig verifizierbarer Zielbezug, darf der Skill **nicht raten**. Der aufrufende Workflow muss dann einen expliziten kanonischen Ref liefern.

### Zweck von Fenstern und Panes

- Halte die tmux-Session auf das Issue oder den PR begrenzt; vermische keine unabhaengigen Issues oder PRs in derselben Session.
- Verwende getrennte Fenster oder Panes fuer lang laufende, aber zusammengehoerende Aufgaben, zum Beispiel:
  - Editor-/Coding-Shell
  - Dev-Server (`npm run dev`)
  - Test-Runner
  - GitHub- oder Log-Inspektion
- Benenne Fenster nach ihrer Funktion, damit ein anderer Operator das Layout schnell versteht.

### Worktree-Ausrichtung

- Der tmux-Kontext ergaenzt die Worktree-Isolation; er ersetzt sie nicht.
- Wenn ein issue-spezifischer Worktree existiert, sollte die aktive Shell innerhalb von tmux dort arbeiten, nicht im Hauptcheckout.
- Eine tmux-Session, die auf den falschen Worktree zeigt, gilt als ungueltiger Workflow-Kontext.
- Fuer exaktes Worktree-Matching und Branch-Korrektur gilt `.github/skills/worktree-naming-conventions/SKILL.md`.

## Plattform: Windows ohne tmux

- tmux hat keinen nativen Windows-Build. `isTmuxAvailable()` in `scripts/start-work.mjs` und `scripts/start-review.mjs` liefert auf `win32` daher immer `false`.
- Der dokumentierte Windows-Pfad ist `--notmux`: die Start-Scripts laufen dann ohne Session-/Fensterlogik und starten Copilot im Vordergrund.
- `npm run start-work`, `npm run start-reqeng` und `npm run start-review` funktionieren auf Windows auch ohne `--notmux`, weil die tmux-Verfuegbarkeit automatisch erkannt wird; `--notmux` macht die Absicht explizit und spart die tmux-Probe.
- Fehlt tmux auf einem POSIX-System, ist das **kein** Abbruchgrund: das Script meldet `Starting Copilot in <worktree> (tmux unavailable)...` und arbeitet im Vordergrund weiter. Es gibt keinen Stacktrace und keine verschachtelte Ersatz-Session.
- Es gibt bewusst **keinen** Windows-spezifischen Multiplexer-Ersatz. Wer Fenster/Panes braucht, nutzt Windows Terminal Splits oder WSL mit tmux.

## Standard-Gates vor der Verwendung eines tmux-Kontexts

Die folgenden Gates gelten **streng in dieser Reihenfolge**. Vor Abschluss von Schritt 1-3 beginnt **keine** issue-/PR-bezogene Implementierungs-, Review-Fix- oder Test-Arbeit.

1. **tmux-Verfuegbarkeit pruefen**
2. **tmux-Sitzungsidentitaet pruefen oder herstellen** (nur wenn tmux verfuegbar ist)
3. **Worktree pruefen oder herstellen**
4. **Erst danach Arbeit beginnen**

### Schritt 1 - tmux-Verfuegbarkeit pruefen

- Pruefe zuerst, ob `tmux` auf dem System verfuegbar ist, z. B. mit `command -v tmux` oder `tmux -V`.
- **Wenn tmux verfuegbar ist:** fahre mit Schritt 2 fort.
- **Wenn tmux nicht verfuegbar ist (oder Windows):** ueberspringe **alle** tmux-bezogenen Folgeschritte ohne Fehler und ohne Blockade und fahre direkt mit Schritt 3 fort.
- Das Fehlen von tmux ist in diesem Repository **kein** Abbruchgrund. Es erlaubt aber auch **keine** Umgehung der nachfolgenden Worktree-, Issue- oder Sicherheits-Gates.
- Auch wenn tmux verfuegbar ist, darf ausserhalb einer bereits bestehenden tmux-Session **keine** neue tmux-Session automatisch erzeugt oder attached werden, ausser der Operator hat den Start ueber eines der `start-*`-Scripts bewusst ausgeloest.

### Schritt 2 - tmux-Sitzungsidentitaet pruefen oder herstellen

- Dieser Schritt gilt **nur**, wenn tmux in Schritt 1 verfuegbar war.
- Vor jeder Session-Pruefung muss ein **eindeutiger kanonischer Ref** feststehen:
  - `IS_<id>` fuer Issue-Kontexte
  - `PR_<id>` fuer PR-Kontexte
  - liegen mehrere moegliche IDs vor oder keine eindeutig verifizierbare Zuordnung, **stoppe**. Der Skill darf keinen Zielkontext stillschweigend erraten.
- Pruefe anschliessend:
  - ob die aktuelle Shell bereits in tmux laeuft (`$TMUX`);
  - falls ja, wie der aktuelle Session-Name lautet, z. B. via `tmux display-message -p '#S'`.
- Namensregel:
  - Der Session-Name muss exakt dem tmux-Format fuer den eindeutigen Ref entsprechen: `IS<n>` oder `PR<n>`.
  - Ein PR-Review darf zusaetzlich in der Session `IS<m>` des verlinkten Issues laufen (vom Launcher geprueft).
- Ergebnis:
  - **Bereits in korrekt benannter Session:** weiter mit Schritt 3.
  - **Issue-Session mit nicht-kanonischem, aber zugehoerigem Namen:** `start-work` kann vor der Branch-/Worktree-Vorbereitung um explizite Zustimmung (`y`/`yes`) zur Umbenennung in `IS<n>` bitten. Die gewaehlte Issue-Nummer muss eine numerische Komponente sein (Buchstaben duerfen angrenzen, Ziffern nicht): `113-0`, `IS_113`, `issue113-work` passen zu Issue 113; `1113` und `1130` nicht. Kollision mit dem kanonischen Namen pruefen, die aktuelle stabile Session-ID adressieren und die Umbenennung verifizieren. Ablehnung oder jeder Fehler fuehrt zum Abbruch; niemals eine andere Session wechseln, beenden oder ueberschreiben.
  - **Nicht zugehoerige Abweichung oder PR-Review-Abweichung:** sofort abbrechen. Eine kanonische PR-Session darf nicht in einen Issue-Kontext umbenannt werden, auch wenn die Nummer passt; `npm run start-review` verwenden. Keine stille Korrektur und keine verschachtelte Ersatz-Session.
  - **Bereits in passender Session:** in ihr ein neues Fenster/Pane fuer denselben Kontext nutzen; keine zweite abweichend benannte Session fuer denselben lokalen Arbeitskontext erfinden.
- Konsistenz-Gate:
  - Eine abweichende Session bleibt ungueltig, bis die ausdruecklich bestaetigte zugehoerige Issue-Umbenennung verifiziert ist. Andernfalls abbrechen; niemals stillschweigend fortfahren oder Sessions wechseln.
  - Innerhalb einer bestehenden tmux-Session niemals `tmux new-session` verwenden; nur neue Fenster oder Panes innerhalb der bestehenden Session.

### Schritt 3 - Worktree pruefen oder herstellen

- Erst nach abgeschlossener tmux-Behandlung aus Schritt 2 - oder direkt nach Schritt 1, wenn tmux nicht verfuegbar ist - darf der Worktree behandelt werden.
- Auch ohne tmux muss vor der Worktree-Aufloesung ein **eindeutiger kanonischer Ref** feststehen. Fehlt er weiterhin, ist der Workflow zu stoppen statt einen Namen zu raten.
- Git-/Worktree-Vorbedingungen:
  - Das Zielverzeichnis muss ein Git-Repository sein (`git rev-parse --show-toplevel` muss funktionieren).
  - `git worktree` muss verfuegbar sein. Ist das Repository kein Git-Repo oder unterstuetzt die lokale Git-Installation keine Worktrees, ist issue-/PR-bezogene lokale Arbeit in diesem Workflow zu stoppen; es darf **nicht** stillschweigend im Hauptcheckout weitergearbeitet werden.
- Kanonischer Worktree-Name:
  - Muster und Ableitungsregeln stehen in `.github/skills/worktree-naming-conventions/SKILL.md`.
- Konsistenz-Gate:
  - Wenn tmux-Session-Name und Worktree-Name auf unterschiedliche kanonische Kontexte zeigen, ist das ein **Hard Stop**.
  - Wenn waehrend der Erstellung ein Race entsteht (z. B. ein anderer Agent erstellt denselben Worktree parallel), pruefe `git worktree list` erneut und reuse den nun vorhandenen Worktree. Keine erzwungene Zweiterstellung und kein Ueberschreiben.

### Schritt 4 - Erst danach Arbeit beginnen

- Erst wenn Schritt 1-3 erfolgreich abgeschlossen oder regelkonform uebersprungen wurden, darf die inhaltliche Arbeit beginnen.
- Vor lokaler Implementierungs- oder Test-Arbeit gelten weiterhin alle repo-weiten Gates, insbesondere:
  - gueltiges GitHub-Issue und erlaubter Status gemaess `.squad/routing.md`
- Dieser Skill richtet also nur den lokalen Ausfuehrungskontext aus; er hebt **keine** fachlichen oder sicherheitsrelevanten Gates auf.
- Fuer die konkrete Port-Berechnung verweist dieser Skill ausdruecklich auf `.github/skills/worktree-naming-conventions/SKILL.md`, um Doppelung zu vermeiden.

## Verhaeltnis zu den Start-Scripts und Prompts

- `.github/prompts/startwork.prompt.md` bleibt der konkrete Start-Workflow. Dieser Skill ersetzt den Prompt nicht, sondern extrahiert das wiederverwendbare tmux-Betriebsmodell dahinter.
- `.github/prompts/startreqeng.prompt.md` und `.github/prompts/startreview.prompt.md` verwenden dasselbe Modell in engeren Kontexten und behalten ihre spezifischen Gates.
- Praktische Vorab-Automation: `npm run start-work`, `npm run start-reqeng`, `npm run start-review` (Details in `scripts/README.md`).
- Die Start-Scripts erwarten den Aufruf **vor** einer Copilot-CLI-Session.

## Abschluss / Teardown

- Die Lebensdauer von Worktree und tmux-Session endet nicht beim ersten Commit, sondern erst mit abgeschlossenem Issue-/PR-Kontext.
- Fuer Worktree-Cleanup gelten die Regeln aus `.squad/templates/worktree-reference.md`:
  - nach Merge bzw. abgeschlossenem lokalen Arbeitsende Worktree entfernen,
  - zugehoerige Branch bereinigen,
  - keine parallele Session eines anderen Agenten abbrechen.
- Fuer tmux gilt analog:
  - eine Session mit dem zugehoerigen Ref-Namen `IS<n>` / `PR<n>` darf erst beendet werden, wenn dort keine aktive Arbeit mehr laeuft;
  - bei gemeinsam genutzten Kontext-Sessions ist koordinierter Abschluss Pflicht, kein stillschweigendes `kill-session`.
- Dieser Skill dokumentiert das Teardown-Prinzip bewusst nur referenzierend, damit Cleanup-Regeln nicht von den Worktree-Lifecycle-Regeln wegdriften.

## Grenzen

- Keine automatische Migration aller Terminal-Workflows zu tmux
- Keine Zusicherung, dass jeder Agent oder jede Repository-Oberflaeche innerhalb von tmux laeuft
- Kein Windows-Multiplexer-Ersatz und keine Umdeutung von `--notmux`
- Kein stillschweigendes Raten eines kanonischen Refs, wenn der Zielkontext unklar ist
- Kein stillschweigendes Weiterarbeiten im Hauptcheckout, wenn ein passender Worktree fehlt oder Git-Worktree-Support nicht verfuegbar ist
- Keine direkte Manipulation von GitHub-Board-Status, Labels oder Assignees, sofern der aufrufende Workflow dies nicht bereits autorisiert
- Keine eigene, von `.github/skills/worktree-naming-conventions/SKILL.md` abweichende Port- oder Benennungslogik
- Keine Sicherheitsausnahme fuer lokale Shells, lang laufende Prozesse oder komfortable Multi-Pane-Setups

## Autorenhinweise fuer kuenftige Prompts

Wenn ein neuer Prompt tmux-Verhalten benoetigt, fokussiere den Prompt auf workflow-spezifische Gates und Ergebnisse und verweise fuer die wiederverwendbare tmux-Schicht auf diesen Skill. Richte die Prompt-Struktur an den bestehenden Dateien in `.github/prompts/` aus: Rolle, Ziel, erforderliche Eingaben, Gates, Schritte, harte Grenzen und Ausgabeerwartungen.
