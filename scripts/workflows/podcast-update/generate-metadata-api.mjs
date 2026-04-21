#!/usr/bin/env node

/**
 * Generate episode metadata using GitHub Copilot API
 * Takes missing episode JSON and generates structured metadata
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");

/**
 * Build prompt for GitHub Copilot
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
 * Call GitHub Copilot API and extract JSON
 */
async function callCopilotAPI(prompt) {
  console.log("🤖 Calling GitHub Copilot API...");

  try {
    const token = process.env.COPILOT_GITHUB_TOKEN;
    if (!token) {
      throw new Error("COPILOT_GITHUB_TOKEN environment variable not set");
    }

    console.log("📤 Sending prompt to Copilot...");

    // Use fetch for API call (available in Node.js 18+)
    const response = await fetch(
      "https://api.github.com/copilot/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Du bist ein hilfreicher Assistent, der ausschließlich JSON-Antworten liefert. Antworte NUR mit einem validen JSON-Objekt, ohne Markdown-Formatierung oder zusätzlichen Text.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("📥 Received response from Copilot");

    let jsonText = data.choices?.[0]?.message?.content?.trim();

    if (!jsonText) {
      throw new Error("No content in Copilot response");
    }

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json?\n?/gm, "").replace(/\n?```$/gm, "");

    // Try to find JSON object in the output
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        "Could not find JSON object in Copilot response. Raw output: " +
          jsonText.substring(0, 200)
      );
    }

    jsonText = jsonMatch[0];

    // Parse JSON
    const metadata = JSON.parse(jsonText);

    console.log("✅ Successfully parsed metadata from Copilot");
    return metadata;
  } catch (error) {
    console.error("❌ Error calling GitHub Copilot API:");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
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

    // Call Copilot API
    const metadata = await callCopilotAPI(prompt);

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
