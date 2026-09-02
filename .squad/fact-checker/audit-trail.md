# Fact Checker Audit Trail

> Append-only evidence log. Entries are succinct — verdict + citation, never raw source material.

<!-- Fact Checker appends findings below -->

## Verification Report — `2026-08-23-souveränität-jenseits-cloud-washing.mdx`

**Date:** 2026-08-28 · **Agent:** Fact Checker · **Trigger:** User „Faktencheck über den Artikel“

### Claims Verified (✅)
- ✅ **ZenDiS-Definition** — Paraphrase deckt sich nahezu wörtlich mit ZenDiS-Whitepaper: „Die Fähigkeit eines Staates oder einer Organisation, digitale Infrastrukturen und Dienste selbstständig, selbstbestimmt und sicher zu gestalten, zu betreiben und weiterzuentwickeln – ohne unkontrollierbare Abhängigkeiten von einzelnen Anbietern oder Drittstaaten.“ (via connect-professional.de #403748 + zendis.de). Auch „rechtliche/technologische/operative Kontrolle + Transparenz/Wechselfähigkeit“ bestätigt.
- ✅ **AWS European Sovereign Cloud** — physisch+logisch getrennt, deutsche Gesellschaft, EU-Bürger in Leitungsgremien/EU-Personal (securecloud.de 15.01.2026; silicon.de bestätigt „physisch und logisch getrennte Cloud-Infrastruktur in der EU“).
- ✅ **Microsoft Sovereign Cloud** — Public-Variante mit Datenresidenz, External Key Management, Data Guardian, vertraulicher Verarbeitung; daneben Private-/Local- und Nationale Partner-Clouds (learn.microsoft.com). MS-Selbstaussage „lokale/private = stärkste Kontrolle, aber nicht voller Cloudwert“ wörtlich bestätigt.
- ✅ **Google Cloud / Thales** — dedizierte Umgebung, von Thales gehörende, von Google getrennte deutsche Gesellschaft, Root of Trust/Schlüssel/Identitäten bei Thales, „Google soll keinen Zugriff auf Betrieb oder Daten haben“, bis Ende 2026 (heise #11338334).
- ✅ **CLOUD Act** — ändert Stored Communications Act; „possession, custody or control“ unabhängig vom Speicherort (securecloud.de + CRS R45173; congress.gov-Fetch 403-geblockt, Dokument real).
- ✅ **FISA Section 702** — Auslandsaufklärung, Nicht-US-Personen außerhalb der USA ohne Einzelanordnung; US-Personen-Kommunikation kann miterfasst werden (it-finanzmagazin #229640).
- ✅ **Art. 48 DSGVO** — Drittstaats-Anordnung nicht allein wegen ausländischen Gerichts vollstreckbar; internationale Übereinkunft nötig; Kapitel-V-Gründe unberührt (EDPB Guidelines 02/2024 v2.1, 05.06.2025).
- ✅ **EDPB-Klarstellung** — Anordnungen gelten nicht automatisch; ohne Abkommen nur ausnahmsweise nach Einzelfallprüfung.
- ✅ **EU-US DPF / Safe Harbor / Privacy Shield** — DPF 2023; Vorgänger gekippt (Schrems I/II).
- ✅ **OVHcloud-Fall** — Ontario Court (Richterin Perkins-McVey) ordnete Herausgabe an RCMP an; Daten lagen in FR/UK/AU, nicht Kanada (heise #11092024). „Nicht zwingend in Kanada“ = korrekt.
- ✅ **EU Data Act** — Chapter VI „Switching between data processing services“; PaaS/SaaS müssen offene Schnittstellen + Export in gängigem, maschinenlesbarem Format bereitstellen; Hürden abbauen (EU-Kommission „Data Act explained“).
- ✅ **Sovereign Cloud Compass** — „Compare by use case, evaluate by criteria … Weighting, Dealbreakers, Sources“ (sovereigncloudcompass.de).
- ✅ **Souveränitäts-Kompass Kister** — 13 Achsen, 0–5-Reifeskala, „Illustrative Schätzwerte, kein Audit“ (sebastiankister.de).
- ✅ **Münchner Score (SDS)** — Stadt München mit TUM-Beteiligung; bewertet Vendor-Lock-in, ausländische Jurisdiktionen, offene Standards (heise #11164082).
- ✅ **Bildpfade** — `sjvcw-header.png` und `sjvcw-001.png` existieren im Artikel-Asset-Ordner.

### Unverified / Minor (⚠️)
- ⚠️ **AWS-Abschnitt „angekündigt“** — ESC ist laut silicon.de seit 15.01.2026 (Brandenburg) allgemein verfügbar; Formulierung unterschlägt den GA-Status (inhaltlich nicht falsch).
- ⚠️ **AWS-Detail „eigene Identitäts-, Abrechnungs- und Namenssysteme“** — AWS-Eigenangabe; in konsultierten Sekundärquellen nicht einzeln belegt, aber plausibel.
- ⚠️ **3 LinkedIn-Post-Links** — nicht automatisiert verifizierbar (Login-Wall); URLs wohlgeformt. Manuelle Prüfung empfohlen.
- ⚠️ **eur-lex.eu GDPR-Link** — Fetch schlug fehl; CELEX-URL `eli/reg/2016/679/oj` ist valide, DSGVO (EU) 2016/679 real.

### Contradicted (❌)
- Keine.

### Counter-Hypotheses
- „Standort in EU schützt“ → Alternativerklärung: Rechtlicher Zugriff folgt Kontrolle/„possession, custody or control“ + extraterritorialen Anordnungen, nicht dem Stromkabel. Artikel argumentiert genau dagegen.
- „Data Act migriert meine Datenbank“ → Data Act schafft Pflichten/Interop, aber keine automatische Migration; Artikel-Aussage korrekt.

### Recommendation
**Proceed** — keine ❌-Befunde. Vor Veröffentlichung empfohlen: (1) AWS-Formulierung auf „verfügbar (GA seit 01/2026)“ präzisieren; (2) die drei LinkedIn-Links manuell gegenchecken.
