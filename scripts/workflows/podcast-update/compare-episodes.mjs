#!/usr/bin/env node

/**
 * Compare Acast RSS feed with existing episodes in doag.md
 * Outputs the oldest missing episode as JSON if found
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");

const ACAST_RSS_URL = "https://feeds.acast.com/public/shows/doag-voices-arbeitstitel";
const DOAG_MD_PATH = join(WORKSPACE_ROOT, "src", "content", "aboutme", "doag.md");

/**
 * Fetch RSS feed from Acast
 */
async function fetchAcastRSS() {
  return new Promise((resolve, reject) => {
    https.get(ACAST_RSS_URL, (res) => {
      let data = "";
      
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        resolve(data);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Extract text content from XML tag
 */
function extractTag(text, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extract attribute from XML tag
 */
function extractAttribute(text, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, "i");
  const match = text.match(regex);
  return match ? match[1] : "";
}

/**
 * Parse RSS XML to episodes array (using simple string parsing)
 */
async function parseRSSFeed(xmlData) {
  // Split into individual items
  const itemMatches = xmlData.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  const episodes = [];
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    
    const title = extractTag(itemXml, "title");
    const pubDateStr = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");
    const audioUrl = extractAttribute(itemXml, "enclosure", "url");
    const link = extractTag(itemXml, "link");
    const guid = extractTag(itemXml, "guid");
    
    if (!title || !pubDateStr) continue;
    
    const pubDate = new Date(pubDateStr);
    
    episodes.push({
      title: title.trim(),
      pubDate: pubDate.toISOString(),
      pubDateFormatted: pubDate.toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }),
      description: description.trim(),
      audioUrl,
      link,
      guid
    });
  }
  
  return episodes;
}

/**
 * Extract episodes from doag.md frontmatter
 */
function getExistingEpisodes() {
  const content = readFileSync(DOAG_MD_PATH, "utf-8");
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error("Could not parse frontmatter from doag.md");
  }
  
  const frontmatter = frontmatterMatch[1];
  
  // Extract episodes array - simple regex approach
  const episodesMatch = frontmatter.match(/episodes:\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/);
  if (!episodesMatch) {
    return [];
  }
  
  const episodesText = episodesMatch[1];
  
  // Extract all episode IDs and titles
  const episodes = [];
  const episodeBlocks = episodesText.split(/\n  - id: /).filter(Boolean);
  
  for (const block of episodeBlocks) {
    const idMatch = block.match(/^(doag-voices-\d+)/);
    const titleMatch = block.match(/title:\s*(.+)/);
    const dateMatch = block.match(/date:\s*(.+)/);
    
    if (idMatch && titleMatch && dateMatch) {
      episodes.push({
        id: idMatch[1],
        title: titleMatch[1].trim(),
        date: dateMatch[1].trim()
      });
    }
  }
  
  return episodes;
}

/**
 * Normalize title for comparison (remove special chars, lowercase, trim)
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if episode already exists by comparing normalized titles and dates
 */
function episodeExists(rssEpisode, existingEpisodes) {
  const normalizedRssTitle = normalizeTitle(rssEpisode.title);
  
  for (const existing of existingEpisodes) {
    const normalizedExistingTitle = normalizeTitle(existing.title);
    
    // Check if titles match (fuzzy)
    if (normalizedRssTitle.includes(normalizedExistingTitle) ||
        normalizedExistingTitle.includes(normalizedRssTitle)) {
      return true;
    }
    
    // Also check if the formatted date matches
    if (existing.date === rssEpisode.pubDateFormatted) {
      return true;
    }
  }
  
  return false;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("📡 Fetching Acast RSS feed...");
    const xmlData = await fetchAcastRSS();
    
    console.log("📋 Parsing RSS feed...");
    const rssEpisodes = await parseRSSFeed(xmlData);
    console.log(`Found ${rssEpisodes.length} episodes in RSS feed`);
    
    console.log("📖 Reading existing episodes from doag.md...");
    const existingEpisodes = getExistingEpisodes();
    console.log(`Found ${existingEpisodes.length} existing episodes`);
    
    console.log("🔍 Comparing episodes...");
    const missingEpisodes = rssEpisodes.filter(
      (rssEp) => !episodeExists(rssEp, existingEpisodes)
    );
    
    if (missingEpisodes.length === 0) {
      console.log("✅ No new episodes found. All episodes are up to date.");
      // Set empty output for GitHub Actions
      if (process.env.GITHUB_OUTPUT) {
        writeFileSync(process.env.GITHUB_OUTPUT, "missing_episode=\n", { flag: "a" });
      }
      process.exit(0);
    }
    
    console.log(`📝 Found ${missingEpisodes.length} missing episode(s)`);
    
    // Sort by publication date (oldest first)
    missingEpisodes.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
    
    const oldestMissing = missingEpisodes[0];
    console.log(`\n📌 Oldest missing episode: "${oldestMissing.title}"`);
    console.log(`   Published: ${oldestMissing.pubDateFormatted}`);
    
    // Write missing episode to file for next step
    const outputPath = join(WORKSPACE_ROOT, "missing-episode.json");
    writeFileSync(outputPath, JSON.stringify(oldestMissing, null, 2));
    console.log(`\n✅ Missing episode details written to: ${outputPath}`);
    
    // Set output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(
        process.env.GITHUB_OUTPUT,
        `missing_episode=${JSON.stringify(oldestMissing)}\n`,
        { flag: "a" }
      );
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
