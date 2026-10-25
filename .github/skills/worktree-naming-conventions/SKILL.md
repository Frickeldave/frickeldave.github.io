---
name: "worktree-naming-conventions"
description: "Kanonische lokale Namens-, Port- und Worktree-Konventionen fuer IS_/PR_-Kontexte"
allowedTools: []
confidence: "high"
domain: "workflow, worktrees, tmux, ports"
source: "abgeleitet aus scripts/start-work.mjs, scripts/start-review.mjs und .github/prompts/startwork.prompt.md"
---

# Skill: worktree-naming-conventions

## Zweck

Verwende diesen Skill, wenn ein lokaler Arbeitskontext fuer genau **einen** kanonischen Ref vorbereitet, validiert oder wiederverwendet werden muss. Der Skill definiert die Worktree-/tmux-Identitaet und die Portbelegung fuer parallele lokale Arbeitskontexte.

## Verwende diesen Skill, wenn

- ein Script oder Prompt einen lokalen Worktree fuer `IS_<id>` oder `PR_<id>` vorbereitet
- tmux-Session und Worktree denselben kanonischen Namen verwenden muessen
- ein Start- oder Resume-Workflow bestehende lokale Kontexte wiederverwenden statt duplizieren soll
- Port-Konflikte zwischen parallelen lokalen Arbeitskontexten deterministisch vermieden werden muessen

## Verwende diesen Skill nicht als

- Ersatz fuer `.squad/routing.md` oder `.squad/decisions.md`
- Ersatz fuer `.github/skills/tmux-session-management/SKILL.md`, wenn es um reine tmux-Mechanik, Fenster oder Verschachtelungsregeln geht
- Anweisung, neue fachliche Branching-Regeln zu erfinden
- Freigabe-Gates zu umgehen
- Migrationsanleitung fuer alte lokale Namensschemata

## Kanonische Identitaet

### Namensschema

- Die kanonische lokale Identitaet lautet exakt:
  - `<ProjectName>_IS_<n>` fuer Issue-Kontexte
  - `<ProjectName>_PR_<n>` fuer PR-Kontexte
- `<ProjectName>` wird **dynamisch** aus dem Namen des registrierten **Hauptcheckouts** abgeleitet: erster `worktree`-Eintrag von `git worktree list --porcelain` (oder `getMainCheckoutPath()` aus `scripts/start-work.mjs`), dann dessen `basename`. Im Issue-Worktree zeigt `git rev-parse --show-toplevel` nur auf den aktiven Worktree; dieser Pfad ist keine Root-Quelle. Kann der Hauptcheckout nicht ermittelt werden, abbrechen statt auf CWD auszuweichen.
- In diesem Repository ist `<ProjectName>` der Verzeichnisname des Repository-Checkouts (z. B. `frickeldave.github.io`). Er ist **nicht** hartcodiert und wird **nicht** aus dem Remote-Namen abgeleitet.
- Es gibt keine Slugs, keine Beschreibungstexte, keine kombinierten Issue+PR-Namen und keine weiteren Suffixe.

### Ablageort des Worktrees

- Primaer liegt der Worktree als Geschwisterverzeichnis des Hauptcheckouts: `<checkout-parent>/<ProjectName>_IS_<n>` bzw. `<checkout-parent>/<ProjectName>_PR_<n>`.
- Ist das Elternverzeichnis nicht beschreibbar, weicht `resolveIssueWorktreePath()` auf einen stabilen, pro Checkout gehashten Pfad aus: `~/.cache/flow-worktrees/<sha256(repoRoot)[0..12]>/<ProjectName>_<REF>_<n>`.
- Der Fallback-Pfad ist reproduzierbar; Worktrees am selben Checkout landen nach einem Neustart wieder im selben Verzeichnis.

## Port-Konvention

### Eine einzige Quelle der Wahrheit

- Ports werden **genau einmal** vom vorbereitenden Script berechnet (`createPortEnvironment()` in `scripts/start-work.mjs`).
- Spaetere Prompts, Agenten oder Shell-Skripte duerfen diese Ports **nicht** aus Session-, Worktree- oder Ref-Namen neu berechnen.
- Die berechneten Ports werden als Environment-Variablen gesetzt (tmux `set-environment` bzw. Prozess-Env im Vordergrundmodus) und danach nur noch **ausgelesen und verwendet**.

### Hash-Basis und Formel

- Hash-Eingabe ist immer der **volle kanonische Name**, z. B. `frickeldave.github.io_IS_480` oder `frickeldave.github.io_PR_91`.
- Formel:
  1. `md5(canonicalName)`
  2. erste `8` Hex-Zeichen
  3. `parseInt(hex, 16) % 1000` als Offset
  4. Basis `40000`
  5. `DEV_SERVER_PORT = BASE + OFFSET`

### Ausgabe- und Nutzungsregel

- Das vorbereitende Script muss die finalen Ports klar ausgeben, z. B. als `Ports: DEV_SERVER_PORT=40423`.
- Der spaeter dispatchte Agent muss beim Starten/Testen der Anwendung ebenfalls den konkret verwendeten Port klar ausgeben, damit manueller Test und Debugging eindeutig moeglich bleiben.
- `npm run dev` startet Astro unabhaengig davon auf dem Standardport; wenn der vorbereitete Port genutzt werden soll, muss er explizit uebergeben werden (z. B. `npm run dev -- --port $DEV_SERVER_PORT`).

## tmux-Bezug zu diesem Skill

- Dieser Skill definiert **nur** das kanonische Namensziel, nicht die gesamte tmux-Bedienung.
- Fuer tmux-Mechanik, Session-Lebenszyklus, Fenster und Verschachtelungsregeln ist `.github/skills/tmux-session-management/SKILL.md` zustaendig.
- Folgende Namens-/Gate-Regeln muessen tmux-seitig eingehalten werden:
  - ausserhalb `$TMUX` niemals automatisch `tmux`-Sessions erzeugen oder attachen
  - innerhalb tmux muss der aktuelle Session-Name **exakt** dem verkuerzten Ref-Namen entsprechen: `IS<n>` oder `PR<n>`
  - bei Abweichung abbrechen, ausser `start-work` holt die explizite Zustimmung fuer eine zugehoerige Issue-Session-Umbenennung ein, prueft Kollisionen und verifiziert die stabile Session-Identitaet gemaess `tmux-session-management`; nicht zugehoerige Namen und PR-Review-Abweichungen fuehren immer zum Abbruch
  - niemals verschachtelte tmux-Sessions; innerhalb einer bestehenden Session nur neue Fenster/Panes im bestehenden Kontext
- Auf Windows gibt es kein tmux: dort laufen die Start-Scripts im Vordergrund (`--notmux`-Pfad), die Namensregeln fuer Sessions entfallen ersatzlos.

## Worktree-Matching und Wiederverwendung

- Neue kanonische Kontexte verwenden fuer die Worktree-Wiederverwendung **exaktes Verzeichnisnamens-Match** auf den kanonischen Namen.
- Ein bereits registrierter Legacy-Worktree bleibt als aktiver Issue-Worktree anhand des Branches erkennbar; sein Verzeichnisname liefert keine Issue-ID und wird nicht automatisch geaendert oder migriert. Neue Workflows matchen ihn nicht als kanonisch benannten Worktree.
- Wenn der kanonische Worktree bereits existiert, wird er wiederverwendet.
- Stimmt der Branch eines bestehenden Worktrees nicht mit der Issue-ID ueberein, abbrechen. Weder Branch-Checkout noch Worktree-Umbenennung ersetzen die Issue-Verifikation.

## Verhaeltnis zu bestehenden Prompts und Scripts

- `.github/prompts/startwork.prompt.md` soll auf diesen Skill verweisen, statt Namens-, Port- und Worktree-Details vollstaendig inline zu duplizieren.
- `scripts/start-work.mjs`, `scripts/start-reqeng.mjs` und `scripts/start-review.mjs` sind die praktische Vorab-Automation dieser Konventionen vor dem eigentlichen Copilot-Dispatch.
- `.github/skills/tmux-session-management/SKILL.md` bleibt fuer tmux-Betriebsregeln zustaendig und verweist fuer das eigentliche Worktree-Namensschema auf diesen Skill; tmux-Session-Namen sind bewusst kuerzer (`IS<n>` / `PR<n>`) als die Worktree-Verzeichnisnamen.

## Grenzen

- Keine automatische Migration alter Worktree- oder tmux-Namen
- Kein stillschweigendes Raten eines Ref-Kontexts
- Keine abweichende Port-Logik pro Subsystem
- Keine zweite, redundante Port-Berechnung in Prompts oder Agenten
