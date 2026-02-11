#!/usr/bin/env node

/**
 * Generate episode metadata using GitHub Copilot CLI
 * Takes missing episode JSON and generates structured metadata
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");

/**
 * Build prompt for GitHub Copilot CLI
 */
function buildCopilotPrompt(episode) {
  return `Analysiere die folgende Podcast-Episode und erstelle daraus strukturierte Metadaten im JSON-Format.

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
Erstelle ein JSON-Objekt mit folgenden Feldern (WICHTIG: Antworte NUR mit dem JSON, ohne zusätzlichen Text):

{
  "title": "Prägnanter Titel der Episode im Stil der existierenden Episoden",
  "edition": "Eine der Editionen: People, FutureAI, DataWorld, CloudTalk oder DevLand",
  "guests": "Namen aller Teilnehmer, z.B. 'Dave König und Dr. Max Mustermann'",
  "date": "Datum im Format '${episode.pubDateFormatted}'",
  "description": "Zusammenfassung der Episode (2-4 Sätze, ähnlich wie existierende Episoden)",
  "links": {
    "spotify": "Spotify Episode Link oder Show-Link: https://open.spotify.com/show/5U7lAyly41FMj6IM7OE4OB",
    "apple": "Apple Podcasts Episode Link oder Show-Link: https://podcasts.apple.com/de/podcast/doag-voices/id1847181531",
    "amazon": "Amazon Music Episode Link oder Show-Link: https://music.amazon.de/podcasts/5d145588-d877-467e-b3b2-bf3da6bf28cd/doag-voices"
  }
}

REGELN:
1. Der Titel sollte prägnant sein und den Inhalt gut zusammenfassen
2. Die Edition muss eine der genannten sein (People, FutureAI, DataWorld, CloudTalk, DevLand)
3. Die Beschreibung sollte informativ sein und den Stil existierender Episoden treffen
4. Wenn spezifische Links zu Spotify/Apple/Amazon nicht identifizierbar sind, verwende die Show-Links
5. Das Datum MUSS exakt "${episode.pubDateFormatted}" sein
6. Antworte NUR mit dem JSON-Objekt, ohne Markdown-Code-Blöcke oder erklärenden Text

Gib jetzt NUR das JSON-Objekt aus:`;
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
    
    // Call gh copilot with the prompt from file
    const command = `gh copilot -p "$(cat ${tempPromptFile})"`;
    
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
      env: env
    });
    
    console.log("📥 Received response from Copilot");
    
    // Clean up temp file
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPromptFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
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
  const requiredFields = ["title", "edition", "guests", "date", "description", "links"];
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
  
  const validEditions = ["People", "FutureAI", "DataWorld", "CloudTalk", "DevLand"];
  if (!validEditions.includes(metadata.edition)) {
    throw new Error(`Invalid edition: ${metadata.edition}. Must be one of: ${validEditions.join(", ")}`);
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
      console.log(`   Description: ${metadata.description.substring(0, 100)}...`);
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
