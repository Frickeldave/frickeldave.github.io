#!/usr/bin/env node

/**
 * Aktualisiert doag.md mit einem neuen Episodeneintrag
 * Erzeugt eine eindeutige 5-stellige ID und fügt die Episode oben im Episoden-Array ein
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");

const DOAG_MD_PATH = join(
  WORKSPACE_ROOT,
  "src",
  "content",
  "aboutme",
  "doag.md"
);

/**
 * Erzeugt eine eindeutige 5-stellige ID, die noch nicht existiert
 */
function generateUniqueId(existingIds) {
  const usedNumbers = new Set(
    existingIds.map((id) => parseInt(id.replace("doag-voices-", "")))
  );

  // Zufällige 5-stellige Zahl erzeugen
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    const number = Math.floor(10000 + Math.random() * 90000);
    if (!usedNumbers.has(number)) {
      return `doag-voices-${number}`;
    }
    attempts++;
  }

  throw new Error("Could not generate unique ID after 1000 attempts");
}

/**
 * Extrahiert die vorhandenen Episoden-IDs aus doag.md
 */
function getExistingIds(content) {
  const idMatches = content.matchAll(/- id: (doag-voices-\d+)/g);
  return Array.from(idMatches).map((match) => match[1]);
}

/**
 * Formatiert den Episodeneintrag für die Einfügung in YAML
 */
function formatEpisodeEntry(id, metadata) {
  const linksEntries = Object.entries(metadata.links)
    .map(([key, value]) => `      ${key}: ${value}`)
    .join("\n");

  // Werte mit ': ' quoten, um YAML-Parse-Fehler bei Plain-Scalars zu vermeiden
  const quoteIfNeeded = (s) => (s.includes(": ") ? `"${s}"` : s);

  return `  - id: ${id}
    title: ${quoteIfNeeded(metadata.title)}
    edition: ${metadata.edition}
    guests: ${quoteIfNeeded(metadata.guests)}
    date: ${metadata.date}
    description: >-
      ${metadata.description}
    links:
${linksEntries}
    audioUrl: >-
      ${metadata.audioUrl}`;
}

/**
 * Fügt die neue Episode am Anfang des Episoden-Arrays ein
 */
function insertEpisode(content, newEpisodeEntry) {
  // Beginn des Episoden-Arrays finden
  const episodesMatch = content.match(/(episodes:\s*\n)( {2}- id:)/);

  if (!episodesMatch) {
    throw new Error("Could not find episodes array in doag.md");
  }

  const insertPosition = episodesMatch.index + episodesMatch[1].length;

  // Neue Episode oben einfügen
  const before = content.substring(0, insertPosition);
  const after = content.substring(insertPosition);

  return before + newEpisodeEntry + "\n" + after;
}

/**
 * Hauptfunktion
 */
async function main() {
  try {
    // Metadaten lesen
    const metadataPath = join(WORKSPACE_ROOT, "metadata.json");
    console.log(`📖 Reading metadata from: ${metadataPath}`);

    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    console.log(`\n📌 Updating doag.md with episode: "${metadata.title}"`);

    // doag.md lesen
    console.log(`📖 Reading doag.md from: ${DOAG_MD_PATH}`);
    const content = readFileSync(DOAG_MD_PATH, "utf-8");

    // Vorhandene IDs ermitteln
    const existingIds = getExistingIds(content);
    console.log(`Found ${existingIds.length} existing episodes`);

    // Eindeutige ID erzeugen
    const newId = generateUniqueId(existingIds);
    console.log(`\n🆔 Generated unique ID: ${newId}`);

    // Episodeneintrag formatieren
    const episodeEntry = formatEpisodeEntry(newId, metadata);

    // Episode einfügen
    console.log("📝 Inserting new episode into doag.md...");
    const updatedContent = insertEpisode(content, episodeEntry);

    // Auf Dry-Run prüfen
    if (process.argv.includes("--dry-run")) {
      console.log("\n🦁 DRY RUN: Skipping file write.");
      console.log("   Would have written to:", DOAG_MD_PATH);
      console.log(
        "   New entry start:\n" +
          episodeEntry.split("\n").slice(0, 5).join("\n") +
          "\n   ..."
      );
    } else {
      // Zurück in die Datei schreiben
      writeFileSync(DOAG_MD_PATH, updatedContent, "utf-8");
      console.log(`\n✅ Successfully updated doag.md`);
    }

    console.log("\n📋 Episode details:");
    console.log(`   ID: ${newId}`);
    console.log(`   Title: ${metadata.title}`);
    console.log(`   Edition: ${metadata.edition}`);
    console.log(`   Date: ${metadata.date}`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
