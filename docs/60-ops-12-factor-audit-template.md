# 12-Factor App Audit Template

## Zweck
Diese Vorlage dient zur strukturierten, nachvollziehbaren Bewertung einer Anwendung nach den 12-Factor-Prinzipien.

## Geltungsbereich
Verwendbar fuer neue Services, groessere Releases, Migrationen und Betriebsfreigaben in diesem Repository.

## Nutzung (Schritte)
1. Pro Faktor Evidenz sammeln (Datei, Konfiguration, Command-Ausgabe).
2. Status setzen: 🟢 (Gruen), 🟡 (Gelb), 🔴 (Rot).
3. Befund kurz und konkret dokumentieren.
4. Massnahmen mit Owner und Zieltermin erfassen.
5. Gesamtentscheidung treffen: Go oder No-Go.

## Status-Legende
- 🟢 (Gruen): Erfuellt, keine kritischen Luecken.
- 🟡 (Gelb): Teilweise erfuellt, Restarbeiten geplant.
- 🔴 (Rot): Nicht erfuellt oder hohes Risiko.

## Gesamtentscheidung (Go/No-Go)
- [ ] Go
- [ ] No-Go
- Begruendung:
- Blocker (falls No-Go):

## Audit-Uebersicht (I-XII)
| Faktor | Primaer | Sekundaer | Status (🟢/🟡/🔴) | Evidenz (Datei/Command) | Befund | Massnahmen |
| --- | --- | --- | --- | --- | --- | --- |
| I. Codebase | Nick | Tony |  |  |  |  |
| II. Dependencies | Bruce | Nick |  |  |  |  |
| III. Config | Bruce | Nick |  |  |  |  |
| IV. Backing Services | Nick | Tony |  |  |  |  |
| V. Build, Release, Run | Nick | Bruce |  |  |  |  |
| VI. Processes | Nick | Bruce |  |  |  |  |
| VII. Port Binding | Nick | Tony |  |  |  |  |
| VIII. Concurrency | Nick | Clint |  |  |  |  |
| IX. Disposability | Clint | Nick |  |  |  |  |
| X. Dev/Prod Parity | Tony | Nick |  |  |  |  |
| XI. Logs | Nick | Maria |  |  |  |  |
| XII. Admin Processes | Bruce | Nick |  |  |  |  |

## Faktor I - Codebase
- [ ] Genau eine Codebase pro App, mehrere Deploys nur ueber Branch/Env.
- [ ] Kein manuelles Hotfixing direkt auf Servern.
- [ ] Reproduzierbarer Checkout/Build dokumentiert.
- [ ] Evidenz eingetragen (z. B. git remote -v, Branch-Strategie).

## Faktor II - Dependencies
- [ ] Alle Abhaengigkeiten explizit im Manifest (z. B. package.json).
- [ ] Lockfile vorhanden und aktuell.
- [ ] Build ohne globale, nicht deklarierte Tools reproduzierbar.
- [ ] Evidenz eingetragen (z. B. npm ci, npm ls).

## Faktor III - Config
- [ ] Laufzeit-Konfig liegt in Environment-Variablen.
- [ ] Keine Secrets im Code oder in statischen Inhalten.
- [ ] Env-Variablen dokumentiert (Name, Zweck, Default-Regel).
- [ ] Evidenz eingetragen (z. B. wrangler config, env docs).

## Faktor IV - Backing Services
- [ ] Externe Dienste sind per Konfig austauschbar.
- [ ] Lokale und produktive Dienste gleiches Integrationsmuster.
- [ ] Timeouts/Retry/Fehlerpfade sind definiert.
- [ ] Evidenz eingetragen (Service-Adapter, Env-Mapping).

## Faktor V - Build, Release, Run
- [ ] Build, Release und Run sind klar getrennt.
- [ ] Release ist unveraenderlich und eindeutig versioniert.
- [ ] Rollback-Pfad fuer letzte stabile Version dokumentiert.
- [ ] Evidenz eingetragen (CI-Workflow, Release-Artefakt).

## Faktor VI - Processes
- [ ] App-Prozesse sind zustandslos; Session-State nicht lokal persistent.
- [ ] Persistenz nur in dedizierten Stores.
- [ ] Wiederanlauf eines Prozesses fuehrt nicht zu Datenverlust.
- [ ] Evidenz eingetragen (Architektur-Doku, Runtime-Verhalten).

## Faktor VII - Port Binding
- [ ] Service stellt sich selbst per Port zur Verfuegung.
- [ ] Keine implizite Kopplung an externen App-Server.
- [ ] Health-Endpoint und Basis-Routing definiert.
- [ ] Evidenz eingetragen (Startkommando, Runtime-Konfig).

## Faktor VIII - Concurrency
- [ ] Horizontaler Scale-out ueber Prozessmodell moeglich.
- [ ] Worker/Job-Typen klar getrennt und benannt.
- [ ] Lastspitzen koennen ohne Architekturbruch abgefangen werden.
- [ ] Evidenz eingetragen (Skalierungsstrategie, Deploy-Settings).

## Faktor IX - Disposability
- [ ] Schneller Start und sauberer, schneller Shutdown.
- [ ] Graceful shutdown fuer In-Flight-Requests umgesetzt.
- [ ] Prozess kann nach Crash sicher neu starten.
- [ ] Evidenz eingetragen (Signal-Handling, Startzeit-Metrik).

## Faktor X - Dev/Prod Parity
- [ ] Moeglichst kleine Differenz zwischen Dev, Stage, Prod.
- [ ] Gleiche Kerntechnologien und vergleichbare Datenfluesse.
- [ ] Deployment-Frequenz und Change-Lead-Time angemessen.
- [ ] Evidenz eingetragen (Umgebungsvergleich, Pipeline-Laufzeiten).

## Faktor XI - Logs
- [ ] Logs werden als Event-Stream behandelt.
- [ ] App schreibt nach stdout/stderr statt in lokale Dateien.
- [ ] Zentrale Aggregation, Filter und Retention sind vorhanden.
- [ ] Evidenz eingetragen (Log-Pipeline, Query-Beispiel).

## Faktor XII - Admin Processes
- [ ] Einmalige Admin-Tasks laufen in gleicher Runtime wie App.
- [ ] Tasks sind versioniert und automatisierbar.
- [ ] Berechtigungen und Audit-Trail fuer Admin-Tasks vorhanden.
- [ ] Evidenz eingetragen (Runbook, Task-Command, CI-Job).

## Abnahme
- [ ] Tony Sign-off (technische Freigabe)
- [ ] Clint Sign-off (betriebliche Freigabe)
- [ ] Datum:
- [ ] Ticket/Referenz:
