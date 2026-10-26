# Copilot-Provider (DeepSeek)

Dieses Dokument beschreibt die optionale Anbindung der Copilot CLI an ein Drittanbieter-Modell.
Aktiviert wird DeepSeek über die Anthropic-kompatible API (BYOK der Copilot CLI). Die Integration
ist **keine Vorgabe**: ohne Aktivierung starten alle Start-Flows unverändert mit den Modellen von
GitHub Copilot.

Die Konfiguration liegt bewusst außerhalb des Repositories unter `~/.config/fd/`. Im Repository gibt
es dafür keine Datei, kein `.env` und kein Docker-`ARG`/`ENV` mit Key.

## Inhaltsverzeichnis

- [Aktivierung](#aktivierung)
- [Dateien und Rechte](#dateien-und-rechte)
- [Variablen](#variablen)
- [Modellwahl pro Lauf (`--model`)](#modellwahl-pro-lauf---model)
- [Provider abschalten (`github`, `--no-provider`)](#provider-abschalten-github---no-provider)
- [Fallback-Verhalten](#fallback-verhalten)
- [Status und Anzeige](#status-und-anzeige)
- [Fehlersuche](#fehlersuche)
- [Provider zurücksetzen (`--reset-provider`)](#provider-zurücksetzen---reset-provider)
- [Drittanbieter-Hinweis](#drittanbieter-hinweis)
- [Sicherheit](#sicherheit)

## Aktivierung

Der Provider ist ein **Opt-in**. Zwei Wege führen dorthin:

1. **Über `fd-setup`** in der Dev-Maschine. Das Onboarding endet mit dem optionalen Schritt `7/7`
   „Optional: DeepSeek-Provider“. Erst nach ausdrücklicher Bestätigung fragt `fd-setup` den Key mit
   `read -rs` ab (keine Anzeige, kein Shell-Verlauf), legt das Verzeichnis mit `0700` und beide
   Dateien mit `0600` an und prüft das Ergebnis anschließend über das Provider-Modul. In
   nicht-interaktiven Läufen schaltet `FD_SETUP_DEEPSEEK=1` den Schritt frei; der Key kommt dann
   über stdin:

   ```bash
   printf '%s\n' "$DEEPSEEK_KEY" | FD_SETUP_DEEPSEEK=1 fd-setup
   ```

   Ohne TTY, bei Ablehnung oder mit `--help` entsteht keine Datei. Eine bereits vorhandene
   Konfiguration überschreibt ein zweiter Lauf nur nach ausdrücklichem `y`.

2. **Über die Konfigurationsdatei.** Wer die Datei selbst anlegt, aktiviert den Provider damit
   ebenfalls — eine **existierende** Konfigurationsdatei ohne `FD_COPILOT_PROVIDER` gilt als Opt-in.

### Manuell aktivieren

```bash
install -d -m 0700 "${XDG_CONFIG_HOME:-$HOME/.config}/fd"
install -m 0600 /dev/null "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.env"
install -m 0600 /dev/null "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.key"
${EDITOR:-vi} "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.env"
${EDITOR:-vi} "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.key"
chmod 600 "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.env" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.key"
```

Mindestinhalt der Konfigurationsdatei:

```ini
# ~/.config/fd/copilot-provider.env
FD_COPILOT_PROVIDER=deepseek
COPILOT_PROVIDER_TYPE=anthropic
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/anthropic
COPILOT_MODEL=deepseek-v4-flash
```

Die Key-Datei enthält **genau eine Zeile** im Format `sk-…` — ohne Anführungszeichen, ohne Präfix
wie `Bearer` und ohne weitere Zeilen. Ein abschließender Zeilenumbruch ist erlaubt. Platzhalter in
dieser Doku sind keine echten Keys. `fd-setup` schreibt zusätzlich `COPILOT_PROVIDER_API_KEY_FILE`,
`COPILOT_MODEL` und beide Token-Limits in die Konfigurationsdatei.

Nach der Aktivierung nutzen `npm run start-work`, `npm run start-reqeng` und `npm run start-review`
den konfigurierten Provider. Ein manuell gestartetes `copilot` bleibt unberührt: Es gibt keinen
`.bashrc`-Hook und kein globales `export`.

> ℹ️ `$HOME` ist im Dev-Pod bewusst flüchtig (kein Volume). Nach einem Pod- oder Image-Neustart ist
> der Key weg und muss erneut gesetzt werden. Das Banner zeigt den Zustand bei jedem Login.

## Dateien und Rechte

| Pfad                                    | Zweck                       | Rechte | Override                     |
| --------------------------------------- | --------------------------- | ------ | ---------------------------- |
| `${XDG_CONFIG_HOME:-$HOME/.config}/fd/` | Konfigurationsverzeichnis   | `0700` | `XDG_CONFIG_HOME`            |
| `…/fd/copilot-provider.env`             | Provider- und Modellauswahl | `0600` | `FD_COPILOT_PROVIDER_CONFIG` |
| `…/fd/copilot-provider.key`             | API-Key, genau eine Zeile   | `0600` | `FD_COPILOT_API_KEY_FILE`    |

Die Prüfung ist **fail-closed** und läuft bei jedem Start, nicht nur beim Anlegen:

- Verzeichnis und Dateien müssen dem effektiven Benutzer (`geteuid`) gehören.
- Der Modus muss **exakt** `0700` bzw. `0600` betragen; `0640` oder `0400` gelten als Fehler.
- Symlinks sind nicht erlaubt, die Key-Datei muss eine reguläre Datei sein.
- Die Key-Datei darf höchstens 512 Byte groß sein und muss dem Muster `sk-` plus mindestens 16
  Zeichen aus `A-Za-z0-9_-` entsprechen.

`FD_COPILOT_PROVIDER_CONFIG` und `FD_COPILOT_API_KEY_FILE` sind für Tests und CI gedacht; im
Normalbetrieb bleiben beide ungesetzt.

## Variablen

Die Konfigurationsdatei akzeptiert ausschließlich die folgende Allowlist. Jeder andere Schlüssel
macht die Konfiguration ungültig.

| Schlüssel                            | Pflicht | Beispielwert                         | Bedeutung                                                |
| ------------------------------------ | ------- | ------------------------------------ | -------------------------------------------------------- |
| `FD_COPILOT_PROVIDER`                | nein    | `deepseek`                           | fd-Schalter: `deepseek` aktiviert, `github` schaltet aus |
| `COPILOT_PROVIDER_TYPE`              | nein    | `anthropic`                          | einziger unterstützter Wert (DeepSeek-Vorgabe)           |
| `COPILOT_PROVIDER_BASE_URL`          | ja      | `https://api.deepseek.com/anthropic` | BYOK-Endpoint; muss `https:` sein                        |
| `COPILOT_MODEL`                      | nein    | `deepseek-v4-flash`                  | Modell, Default `deepseek-v4-flash`                      |
| `COPILOT_PROVIDER_MODEL_ID`          | nein    | `deepseek-v4-flash`                  | Alternative zu `COPILOT_MODEL`                           |
| `COPILOT_PROVIDER_WIRE_MODEL`        | nein    | `deepseek-v4-flash`                  | wird unverändert an die CLI durchgereicht                |
| `COPILOT_PROVIDER_MAX_PROMPT_TOKENS` | nein    | `840000`                             | Prompt-Limit, Default `840000`                           |
| `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS` | nein    | `128000`                             | Ausgabe-Limit, Default `128000`                          |
| `COPILOT_PROVIDER_API_KEY_FILE`      | nein    | `/home/appuser/.config/fd/key`       | absoluter Pfad zu einer alternativen Key-Datei           |

Nicht akzeptiert werden `COPILOT_PROVIDER_API_KEY`, `COPILOT_PROVIDER_API_KEY_COMMAND` und
`COPILOT_PROVIDER_BEARER_TOKEN`. Den Key-Kanal erzeugt der Loader selbst als
`COPILOT_PROVIDER_API_KEY_COMMAND="cat '<pfad>'"`; in der Datei wäre der Schlüssel ein
Code-Ausführungsrisiko.

Format der Datei:

- reines `KEY=VALUE`, eine Zuweisung pro Zeile, optional einfache oder doppelte Anführungszeichen
- `#` nur als vollständige Kommentarzeile — kein Kommentar hinter einem Wert
- keine Shell-Syntax: kein `source`, kein `export`, keine `$(…)`, keine Backticks, keine
  `${…}`-Expansion, keine Zeilenfortsetzung, keine `\`-Escapes
- Werte ohne Leerzeichen; erlaubt sind Buchstaben, Ziffern und `. _ : / @ + -`
- CRLF wird toleriert; Grenzen: 8 KiB Datei, 4 KiB pro Zeile, 64 Zeilen

Unterstützte Modelle sind `deepseek-v4-flash` und `deepseek-v4-pro`. Token-Limits werden in der
Reihenfolge Konfigurationsdatei → Shell-Env → Default aufgelöst.

## Modellwahl pro Lauf (`--model`)

Alle drei Start-Flows kennen `--model <id>` und `--no-provider`. Die Precedence lautet:

1. `--model` aus der Kommandozeile
2. `COPILOT_MODEL` bzw. `COPILOT_PROVIDER_MODEL_ID` aus der Konfigurationsdatei
3. bereits exportiertes `COPILOT_MODEL` in der Shell
4. Default `deepseek-v4-flash`

```bash
npm run start-work -- IS_285 --model deepseek-v4-pro
npm run start-reqeng -- IS_285 --model deepseek-v4-pro
npm run start-review -- PR_287 --model deepseek-v4-pro
```

Der Wert geht aus **demselben** Plan sowohl an `--model` der CLI als auch als `COPILOT_MODEL` in die
Prozessumgebung der CLI. Damit wirkt die Wahl auch in einer bereits laufenden tmux-Session, und sie
ist in `ps` sichtbar. Die Konfigurationsdatei bleibt byte-identisch; ein Lauf ohne Flag nutzt wieder
den Wert aus der Datei.

Ein `--model`, das nicht in der Allowlist steht, ist ein **harter Fehler**: Der Flow bricht vor dem
Copilot-Start mit Exit ≠ 0 ab. Eine bewusste Nutzereingabe wird nicht still umgeschrieben.

## Provider abschalten (`github`, `--no-provider`)

| Weg                                       | Wirkung                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| `--no-provider` am Start-Flow             | nur dieser Lauf nutzt GitHub-Copilot-Modelle            |
| `FD_COPILOT_PROVIDER=github` in der Datei | dauerhaft aus, Datei und Key bleiben liegen             |
| `FD_COPILOT_PROVIDER=github` in der Shell | dauerhaft aus, solange die Variable exportiert ist      |
| Konfigurationsdatei löschen               | Opt-out ohne Warnung, Verhalten wie vor der Aktivierung |

Ein ausgesprochenes Opt-out gewinnt immer. Ohne Konfigurationsdatei und ohne
`FD_COPILOT_PROVIDER=deepseek` fasst der Start weder die Prozessumgebung an noch gibt er eine
Provider-Zeile aus.

## Fallback-Verhalten

Kann der Plan keinen gültigen Provider bilden, startet der Flow mit den GitHub-Copilot-Modellen:

- die Provider-Variablen werden aus dem Kind-Env **entfernt** (`env -u …`), damit etwa ein altes
  `COPILOT_PROVIDER_TYPE=openai` nicht durchschlägt
- es wird **kein** `--model` übergeben
- es erscheint **genau eine** Warnzeile mit Grund und Provider-Host, aber ohne Key-Material

Beispiel für eine solche Zeile (exemplarisch, der Pfad ist der aufgelöste Key-Pfad):

```text
Copilot provider: missing key file /home/appuser/.config/fd/copilot-provider.key (create it with fd-setup). Using GitHub Copilot models instead (provider host: api.deepseek.com).
```

Auslöser für den Fallback sind unter anderem: fehlende oder ungültige Key-Datei, falsche Rechte,
ungültige Konfiguration, ein `FD_COPILOT_PROVIDER=deepseek` ohne Konfigurationsdatei sowie
`--no-provider`.

Nicht in den Fallback, sondern in einen Abbruch führt ein ungültiges `--model` (siehe oben).

## Status und Anzeige

Der Status arbeitet offline: kein API-Aufruf, kein Key-Inhalt, keine Key-Länge, kein Hash.

```bash
node scripts/copilot-environment.mjs status      # Gesamtstatus inklusive Provider-Block
node scripts/copilot-environment.mjs provider    # nur der Provider-Block
node scripts/copilot-environment.mjs provider --line   # genau eine Zeile
node scripts/copilot-environment.mjs provider --state  # set|unset|invalid-permissions
```

Mit aktivem Provider zeigt `provider` Typ, Base-URL, effektives Modell und beide Limits:

```text
Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-flash
  Provider type     : anthropic
  Provider base URL : https://api.deepseek.com/anthropic
  Provider model    : deepseek-v4-flash
  Provider limits   : prompt=840000 output=128000
```

Ohne Opt-in steht dort `Provider : GitHub Copilot (Standard)`. Bei ungesicherten Rechten meldet der
Status `Provider : invalid-permissions (GitHub Copilot in use)` und die Start-Flows fallen zurück.

`fd-status` und das Login-Banner `fd-welcome` zeigen genau eine Zeile — je nach Zustand exemplarisch
`Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-flash` oder
`Provider : GitHub Copilot (Standard)`. Die Statusfunktion gibt dafür nur `set`, `unset` oder
`invalid-permissions` aus; Key, Länge und Präfix bleiben außen vor.

Ist BYOK aktiv, meldet der Auth-Status nicht mehr „nicht eingeloggt“: BYOK braucht laut
`copilot help providers` keine GitHub-Authentifizierung.

## Fehlersuche

Erster Schritt ist immer der Offline-Status:

```bash
node scripts/copilot-environment.mjs provider
fd-status
```

Die Meldungen nennen Pfad, Schlüssel oder Lösung, aber nie den Key-Inhalt.

### Rechte-Matrix

| Fallback-Grund                                  | Ursache                                                        | Lösung                           |
| ----------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| `Key file … must have mode 0600`                | Key-Datei ist zu offen (`0644`, `0640`)                        | `chmod 600 <key>`                |
| `Configuration file … must have mode 0600`      | Konfigurationsdatei ist zu offen                               | `chmod 600 <datei>`              |
| `Configuration directory … must have mode 0700` | `~/.config/fd` ist zu offen                                    | `chmod 700 ~/.config/fd`         |
| `… must be owned by uid …`                      | Datei gehört einem anderen Benutzer                            | Datei neu mit `fd-setup` anlegen |
| `… must not be a symbolic link`                 | Dotfiles-Manager oder Symlink                                  | echte Datei anlegen              |
| `missing key file …`                            | Key fehlt oder `COPILOT_PROVIDER_API_KEY_FILE` zeigt ins Leere | `fd-setup` erneut ausführen      |
| `does not contain exactly one sk-… key`         | Leerzeilen, `Bearer`-Präfix oder Vertipper                     | Key-Datei neu schreiben          |
| `is larger than 512 bytes`                      | Mehrere Keys oder Kopierfehler                                 | Key-Datei neu schreiben          |

### Unbekannte Schlüssel und Shell-Syntax

Die Datei ist bewusst kein Shell-Skript. Ein Tippfehler soll nicht still in den GitHub-Modus fallen,
sondern als Fehler sichtbar werden.

| Meldung                                                                                                      | Ursache                                           |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `unknown key "COPILOT_MODEL_TYPO"`                                                                           | Schlüssel nicht in der Allowlist                  |
| `line 2 uses unsupported syntax; only KEY=VALUE lines are allowed (no export, no shell syntax)`              | `export`-Präfix, `$(…)` oder `${…}`               |
| `invalid value for "…"; no spaces, quotes, escapes or shell expansion`                                       | Leerzeichen, `~` oder Escape im Wert              |
| `duplicate key "…"`                                                                                          | Schlüssel steht zweimal in der Datei              |
| `key "COPILOT_PROVIDER_API_KEY" is not accepted in the configuration; the loader passes the key file itself` | Key direkt in die Datei geschrieben               |
| `COPILOT_PROVIDER_TYPE must be "anthropic"; …`                                                               | z. B. `openai`, das DeepSeek mit HTTP 400 ablehnt |
| `COPILOT_PROVIDER_BASE_URL must be an https:// URL`                                                          | `http://` oder relativer Endpoint                 |
| `COPILOT_MODEL must be one of deepseek-v4-flash, deepseek-v4-pro`                                            | anderes Modell in der Datei                       |

### Ungültiges `--model`

```text
Unsupported --model "deepseek-v5". Supported Copilot provider models: deepseek-v4-flash, deepseek-v4-pro.
```

Der Flow endet mit Exit ≠ 0, bevor Copilot startet. Abhilfe: eines der beiden Modelle angeben oder
das Flag weglassen und den Wert aus der Konfigurationsdatei verwenden.

## Provider zurücksetzen (`--reset-provider`)

```bash
fd-setup --reset-provider
```

Der Aufruf löscht Konfigurationsdatei und Key-Datei, entfernt das leere Verzeichnis, stellt den
GitHub-Default wieder her und gibt einen Widerrufshinweis aus. Widerrufen wird der Key unter
<https://platform.deepseek.com/api_keys>; das Löschen der Datei allein genügt dafür nicht. Manuell
entspricht das:

```bash
rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.env" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/fd/copilot-provider.key"
```

## Drittanbieter-Hinweis

Mit aktivem Provider laufen die Prompts der Copilot CLI und der Code-Kontext der Sitzung — inklusive
Dateien, die die CLI liest — an **DeepSeek** (`api.deepseek.com`) und nicht an GitHub. Das ist die
bewusste Folge der Aktivierung:

- **Opt-in:** Ohne ausdrückliche Aktivierung verlässt kein Kontext das GitHub-Ökosystem. `fd-setup`
  weist einmalig auf den Drittanbieter hin und verlangt eine Bestätigung.
- **Host:** `https://api.deepseek.com/anthropic`, Modell `deepseek-v4-flash` oder `deepseek-v4-pro`.
- **Widerruf:** `fd-setup --reset-provider` entfernt die lokale Konfiguration; den Key zusätzlich im
  Anbieter-Dashboard widerrufen.
- **Fallback:** Ist der Provider nicht nutzbar, laufen die Flows wieder über GitHub-Copilot-Modelle.
  Ein stiller Wechsel in die andere Richtung findet nicht statt.

Trainings- und Aufbewahrungspraxis, ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO) sowie die
Zulässigkeit des Drittlandtransfers (Art. 44 ff. DSGVO) sind vor einem produktiven Einsatz mit
vertraulichen Inhalten zu klären.

## Sicherheit

**Keine Secrets im Repository — mit einer bewusst begrenzten Ausnahme.** Der Provider-Key liegt als
Datei mit dem Modus `0600` außerhalb des Repositories, im Verzeichnis `~/.config/fd` mit `0700`. Er
wird nie in eine getrackte Datei, ein `.env` in der Projektwurzel, ein Docker-`ARG`/`ENV` oder in
ein Log geschrieben. `.env.example` bleibt deshalb unverändert.

Innerhalb eines Laufs erreicht der Key die CLI ausschließlich über
`COPILOT_PROVIDER_API_KEY_COMMAND="cat '<pfad>'"`. Damit steht er weder in `process.env` noch in
`argv` noch in `tmux show-environment` noch in `ps` — nur der Pfad. Fehlermeldungen nennen Pfad und
Lösung, nie Inhalt, Länge oder Hash. Die Provider-Variablen werden pro Fenster über das
`exec env …`-Präfix übergeben; die tmux-Session-Umgebung bleibt für sie ungenutzt.

## Siehe auch

- [Skript-Dokumentation](../scripts/README.md) — Provider-Modul und Flags der Start-Flows
- [fd-dev-full](../.github/workflows/fd-bootstrap/docker-dev-full/README.md) — Onboarding und Image
- [Nutzung](./11-dev-usage.md) — Befehle, Squad- und Release-Werkzeuge
