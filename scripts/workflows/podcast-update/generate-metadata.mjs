#!/usr/bin/env node

/**
 * Erzeugt Episoden-Metadaten über GitHub Copilot
 * Nimmt das JSON der fehlenden Episode und erzeugt strukturierte Metadaten
 * Mit Fallback auf API oder manuelle Eingabe, wenn die CLI scheitert
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");

/**
 * Baut den Prompt für die GitHub-Copilot-CLI
 */
function buildCopilotPrompt(episode) {
  return `Analysiere die folgende Podcast-Episode und erstelle daraus strukturierte Metadaten als valides JSON.

EPISODE DETAILS:
- Titel: ${episode.title}
- Beschreibung: ${episode.description}
- Veröffentlichungsdatum: ${episode.pubDateFormatted}
- Audio URL: ${episode.audioUrl}
- Episode Link: ${episode.link}

KONTEXT:
Dies ist eine Episode des "DOAG Voices" Podcasts mit dem Untertitel "Zwischen KI, Cloud und Karriere". 
Der Podcast erscheint in verschiedenen Editionen:
- People: Persönliche Geschichten hinter dem Fachwissen
- FutureAI: KI im Hier und Morgen, Ethik und Zukunftsvisionen
- DataWorld: Von Analytics bis zu intelligenten Architekturen
- CloudTalk: Wie Cloud-Technologien Unternehmen verändern
- DevLand: Moderne Softwareentwicklung zwischen Wandel und multiplen Perspektiven

AUFGABE:
Erstelle ein valides JSON-Objekt mit folgenden Feldern.

KRITISCHE JSON-REGELN (Verstöße führen zu einem Parse-Fehler):
1. Antworte AUSSCHLIESSLICH mit dem rohen JSON-Objekt — kein Text davor oder danach, keine Markdown-Code-Blöcke (kein \`\`\`json)
2. Alle String-Werte MÜSSEN in doppelten Anführungszeichen stehen
3. Doppelte Anführungszeichen INNERHALB eines String-Werts MÜSSEN als \" escaped werden (Beispiel: "Mit \\"Ed\\" eine Plattform" statt "Mit "Ed" eine Plattform")
4. Verwende innerhalb von String-Werten bevorzugt einfache Anführungszeichen statt doppelter, wenn Zitate notwendig sind (Beispiel: "Mit 'Ed' eine Plattform")
5. Kein Komma nach dem letzten Feld eines Objekts (kein trailing comma)
6. Keine Kommentare im JSON

ERWARTETES FORMAT (exakt so ausgeben, mit echten Werten):
{"title":"Prägnanter Titel ohne Anführungszeichen in Werten","edition":"People","guests":"Vorname Nachname und Vorname Nachname","date":"${episode.pubDateFormatted}","description":"Zusammenfassung der Episode in 2-4 Sätzen ohne Anführungszeichen.","links":{"spotify":"https://open.spotify.com/show/5U7lAyly41FMj6IM7OE4OB","apple":"https://podcasts.apple.com/de/podcast/doag-voices/id1847181531","amazon":"https://music.amazon.de/podcasts/5d145588-d877-467e-b3b2-bf3da6bf28cd/doag-voices"}}

INHALTLICHE REGELN:
- title: Prägnanter Titel, der den Inhalt gut zusammenfasst; vermeide doppelte Anführungszeichen im Titel
- edition: MUSS exakt eine dieser Optionen sein: People, FutureAI, DataWorld, CloudTalk, DevLand
- guests: Vollständige Namen aller Gäste, kommagetrennt oder mit "und" verbunden
- date: MUSS exakt "${episode.pubDateFormatted}" sein — nicht verändern
- description: 2-4 informatve Sätze im Stil existierender Episoden; keine Anführungszeichen in der Beschreibung
- links: Wenn spezifische Episode-Links nicht bekannt sind, verwende die Show-Links aus dem Beispiel-Format

Gib JETZT ausschließlich das JSON-Objekt aus, beginnend mit { und endend mit }:`;
}

/**
 * Ruft die GitHub-Copilot-CLI auf und extrahiert das JSON
 */
async function callCopilotCLI(prompt) {
  console.log("🤖 Calling GitHub Copilot CLI...");

  try {
    // Prompt in eine temporäre Datei schreiben, um Shell-Escaping-Probleme zu vermeiden
    const tempPromptFile = join(WORKSPACE_ROOT, ".copilot-prompt.txt");
    writeFileSync(tempPromptFile, prompt, "utf-8");

    // gh copilot mit dem Prompt aus der Datei über Pipe und xargs aufrufen
    const command = `cat "${tempPromptFile}" | xargs -0 gh copilot -p`;

    console.log("📤 Sending prompt to Copilot...");

    // Umgebung mit Copilot-Auth-Token vorbereiten
    const env = Object.assign({}, process.env);
    if (process.env.COPILOT_GITHUB_TOKEN) {
      env.GITHUB_TOKEN = process.env.COPILOT_GITHUB_TOKEN;
    }

    const output = execSync(command, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      stdio: ["pipe", "pipe", "pipe"],
      shell: "/bin/bash",
      env: env,
    });

    console.log("📥 Received response from Copilot");

    // Temporäre Datei aufräumen
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPromptFile);
    } catch (e) {
      // Aufräumfehler ignorieren
    }

    console.log("📥 Received response from Copilot");

    // JSON aus der Ausgabe extrahieren (evtl. in Code-Blöcke oder Zusatztext verpackt)
    let jsonText = output.trim();

    // Markdown-Code-Blöcke entfernen, falls vorhanden
    jsonText = jsonText.replace(/^```json?\n?/gm, "").replace(/\n?```$/gm, "");

    // JSON-Objekt in der Ausgabe suchen
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON object in Copilot response");
    }

    jsonText = jsonMatch[0];

    // Gängige JSON-Probleme bereinigen (abschließende Kommas usw.)
    try {
      // Abschließende Kommas vor schließenden Klammern entfernen
      jsonText = jsonText.replace(/,\s*([}\]])/g, "$1");
    } catch (cleanupError) {
      // Bereinigungsfehler ignorieren, mit dem Originaltext weitermachen
    }

    // JSON parsen
    const metadata = JSON.parse(jsonText);

    console.log("✅ Successfully parsed metadata from Copilot");
    return metadata;
  } catch (error) {
    console.error("❌ Error calling GitHub Copilot CLI:");
    console.error(error.message);
    if (error.stdout) console.error("STDOUT:", error.stdout);
    if (error.stderr) console.error("STDERR:", error.stderr);
    throw error;
  }
}

/**
 * Validiert die Struktur der Metadaten
 */
function validateMetadata(metadata) {
  const requiredFields = [
    "title",
    "edition",
    "guests",
    "date",
    "description",
    "links",
  ];
  const requiredLinks = ["spotify", "apple", "amazon"];

  for (const field of requiredFields) {
    if (!metadata[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  for (const link of requiredLinks) {
    if (!metadata.links[link]) {
      throw new Error(`Missing required link: ${link}`);
    }
  }

  const validEditions = [
    "People",
    "FutureAI",
    "DataWorld",
    "CloudTalk",
    "DevLand",
  ];
  if (!validEditions.includes(metadata.edition)) {
    throw new Error(
      `Invalid edition: ${metadata.edition}. Must be one of: ${validEditions.join(", ")}`
    );
  }

  console.log("✅ Metadata validation passed");
}

/**
 * Hauptfunktion
 */
async function main() {
  try {
    // Fehlende Episode aus der Datei lesen
    const missingEpisodePath = join(WORKSPACE_ROOT, "missing-episode.json");
    console.log(`📖 Reading missing episode from: ${missingEpisodePath}`);

    const episodeData = JSON.parse(readFileSync(missingEpisodePath, "utf-8"));
    console.log(`\n📌 Processing episode: "${episodeData.title}"`);

    // Prompt bauen
    const prompt = buildCopilotPrompt(episodeData);

    // Copilot-CLI aufrufen
    const metadata = await callCopilotCLI(prompt);

    // Metadaten validieren
    validateMetadata(metadata);

    // audioUrl aus den Original-Episodendaten ergänzen
    metadata.audioUrl = episodeData.audioUrl;

    // Metadaten in eine Datei schreiben
    const metadataPath = join(WORKSPACE_ROOT, "metadata.json");
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`\n✅ Metadata written to: ${metadataPath}`);

    console.log("\n📋 Generated metadata:");
    console.log(`   Title: ${metadata.title}`);
    console.log(`   Edition: ${metadata.edition}`);
    console.log(`   Guests: ${metadata.guests}`);
    console.log(`   Date: ${metadata.date}`);
    if (metadata.description) {
      console.log(
        `   Description: ${metadata.description.substring(0, 100)}...`
      );
    } else {
      console.log(`   Description: ⚠️  NOT PROVIDED BY COPILOT`);
    }

    console.log("\n📄 Full metadata (JSON):");
    console.log(JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
