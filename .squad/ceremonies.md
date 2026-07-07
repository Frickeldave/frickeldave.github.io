# Zeremonien

> Teambesprechungen, die vor oder nach der Arbeit stattfinden. Jedes Squad konfiguriert seine eigenen.

## Design-Review

| Feld | Wert |
|-------|-------|
| **Auslöser** | auto |
| **Wann** | vorher |
| **Bedingung** | Multi-Agent-Aufgabe mit 2+ Agenten, die geteilte Systeme ändern |
| **Moderator** | lead |
| **Teilnehmer** | alle-betroffenen |
| **Zeitbudget** | fokussiert |
| **Aktiviert** | ✅ ja |

**Agenda:**
1. Aufgabe und Anforderungen überprüfen
2. Schnittstellen und Verträge zwischen Komponenten vereinbaren
3. Risiken und Randfälle identifizieren
4. Action Items zuweisen

---

## Retrospektive

| Feld | Wert |
|-------|-------|
| **Auslöser** | auto |
| **Wann** | nachher |
| **Bedingung** | Build-Fehler, Test-Fehler oder Reviewer-Ablehnung |
| **Moderator** | lead |
| **Teilnehmer** | alle-beteiligten |
| **Zeitbudget** | fokussiert |
| **Aktiviert** | ✅ ja |

**Agenda:**
1. Was ist passiert? (nur Fakten)
2. Ursachenanalyse
3. Was sollte sich ändern?
4. Action Items für nächste Iteration

---

## Retrospektive mit Durchsetzung

| Feld | Wert |
|-------|-------|
| **Auslöser** | auto |
| **Wann** | wöchentlich |
| **Bedingung** | Kein *Retrospektive*-Log in `.squad/log/` innerhalb der letzten 7 Tage |
| **Moderator** | lead |
| **Teilnehmer** | alle |
| **Zeitbudget** | fokussiert |
| **Aktiviert** | ja |
| **Durchsetzungs-Skill** | retro-enforcement |

**Agenda:**
1. Was diese Woche ausgeliefert? (geschlossene Issues, gemergte PRs)
2. Was nicht ausgeliefert? (offene Issues, Blocker)
3. Ursachen bei Fehlern
4. Action Items — jedes MUSS zu GitHub-Issue mit Label `retro-action` werden

**Koordinator-Integration:**
Am Runde-Start `Test-RetroOverdue` aufrufen (siehe Skill retro-enforcement). Wenn überfällig, führe diese Zeremonie vor der Work Queue aus.

**Warum GitHub Issues, nicht Markdown:**
Produktionsdaten: 0% Completion über 6 Retros mit Markdown-Checklisten, 100% nach Wechsel zu GitHub Issues.
