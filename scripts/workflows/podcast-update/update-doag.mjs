#!/usr/bin/env node

/**
 * Update doag.md with new episode entry
 * Generates a unique 5-digit ID and inserts the episode at the top of the episodes array
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
 * Generate a unique 5-digit ID that doesn't exist yet
 */
function generateUniqueId(existingIds) {
  const usedNumbers = new Set(
    existingIds.map((id) => parseInt(id.replace("doag-voices-", "")))
  );

  // Generate random 5-digit number
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
 * Extract existing episode IDs from doag.md
 */
function getExistingIds(content) {
  const idMatches = content.matchAll(/- id: (doag-voices-\d+)/g);
  return Array.from(idMatches).map((match) => match[1]);
}

/**
 * Format episode entry for insertion into YAML
 */
function formatEpisodeEntry(id, metadata) {
  const linksEntries = Object.entries(metadata.links)
    .map(([key, value]) => `      ${key}: ${value}`)
    .join("\n");

  return `  - id: ${id}
    title: ${metadata.title}
    edition: ${metadata.edition}
    guests: ${metadata.guests}
    date: ${metadata.date}
    description: >-
      ${metadata.description}
    links:
${linksEntries}
    audioUrl: >-
      ${metadata.audioUrl}`;
}

/**
 * Insert new episode at the beginning of the episodes array
 */
function insertEpisode(content, newEpisodeEntry) {
  // Find the episodes array start
  const episodesMatch = content.match(/(episodes:\s*\n)( {2}- id:)/);

  if (!episodesMatch) {
    throw new Error("Could not find episodes array in doag.md");
  }

  const insertPosition = episodesMatch.index + episodesMatch[1].length;

  // Insert new episode at the top
  const before = content.substring(0, insertPosition);
  const after = content.substring(insertPosition);

  return before + newEpisodeEntry + "\n" + after;
}

/**
 * Main function
 */
async function main() {
  try {
    // Read metadata
    const metadataPath = join(WORKSPACE_ROOT, "metadata.json");
    console.log(`📖 Reading metadata from: ${metadataPath}`);

    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    console.log(`\n📌 Updating doag.md with episode: "${metadata.title}"`);

    // Read doag.md
    console.log(`📖 Reading doag.md from: ${DOAG_MD_PATH}`);
    const content = readFileSync(DOAG_MD_PATH, "utf-8");

    // Get existing IDs
    const existingIds = getExistingIds(content);
    console.log(`Found ${existingIds.length} existing episodes`);

    // Generate unique ID
    const newId = generateUniqueId(existingIds);
    console.log(`\n🆔 Generated unique ID: ${newId}`);

    // Format episode entry
    const episodeEntry = formatEpisodeEntry(newId, metadata);

    // Insert episode
    console.log("📝 Inserting new episode into doag.md...");
    const updatedContent = insertEpisode(content, episodeEntry);

    // Check for dry-run
    if (process.argv.includes("--dry-run")) {
      console.log("\n🦁 DRY RUN: Skipping file write.");
      console.log("   Would have written to:", DOAG_MD_PATH);
      console.log(
        "   New entry start:\n" +
          episodeEntry.split("\n").slice(0, 5).join("\n") +
          "\n   ..."
      );
    } else {
      // Write back to file
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
