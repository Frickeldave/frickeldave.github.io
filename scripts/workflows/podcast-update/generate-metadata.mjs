#!/usr/bin/env node

/**
 * Generate episode metadata using GitHub Copilot
 * Takes missing episode JSON and generates structured metadata
 * With fallback to API or manual input if CLI fails
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
 * Build prompt for GitHub Copilot CLI
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
 * Call GitHub Copilot CLI and extract JSON
 */
async function callCopilotCLI(prompt) {
  console.log("🤖 Calling GitHub Copilot CLI...");

  try {
    // Write prompt to temporary file to avoid shell escaping issues
    const tempPromptFile = join(WORKSPACE_ROOT, ".copilot-prompt.txt");
    writeFileSync(tempPromptFile, prompt, "utf-8");

    // Call gh copilot with the prompt from file using pipe and xargs
    const command = `cat "${tempPromptFile}" | xargs -0 gh copilot -p`;

    console.log("📤 Sending prompt to Copilot...");

    // Prepare environment with Copilot auth token
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

    // Clean up temp file
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPromptFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log("📥 Received response from Copilot");

    // Extract JSON from output (might be wrapped in code blocks or have extra text)
    let jsonText = output.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json?\n?/gm, "").replace(/\n?```$/gm, "");

    // Try to find JSON object in the output
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON object in Copilot response");
    }

    jsonText = jsonMatch[0];

    // Clean up common JSON issues (trailing commas, etc.)
    try {
      // Remove trailing commas before closing braces/brackets
      jsonText = jsonText.replace(/,\s*([}\]])/g, "$1");
    } catch (cleanupError) {
      // Ignore cleanup errors, continue with original text
    }

    // Parse JSON
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
 * Validate metadata structure
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
 * Main function
 */
async function main() {
  try {
    // Read missing episode from file
    const missingEpisodePath = join(WORKSPACE_ROOT, "missing-episode.json");
    console.log(`📖 Reading missing episode from: ${missingEpisodePath}`);

    const episodeData = JSON.parse(readFileSync(missingEpisodePath, "utf-8"));
    console.log(`\n📌 Processing episode: "${episodeData.title}"`);

    // Build prompt
    const prompt = buildCopilotPrompt(episodeData);

    // Call Copilot CLI
    const metadata = await callCopilotCLI(prompt);

    // Validate metadata
    validateMetadata(metadata);

    // Add audioUrl from original episode data
    metadata.audioUrl = episodeData.audioUrl;

    // Write metadata to file
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
