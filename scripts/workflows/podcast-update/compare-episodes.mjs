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

const ACAST_RSS_URL =
  "https://feeds.acast.com/public/shows/doag-voices-arbeitstitel";
const DOAG_MD_PATH = join(
  WORKSPACE_ROOT,
  "src",
  "content",
  "aboutme",
  "doag.md"
);

/**
 * Fetch RSS feed from Acast
 */
async function fetchAcastRSS() {
  return new Promise((resolve, reject) => {
    https
      .get(ACAST_RSS_URL, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", (err) => {
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
  let result = match ? match[1].trim() : "";
  // Remove CDATA wrapper if present
  result = result.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
  return result;
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
 * Strip HTML tags and decode entities
 */
function cleanHtml(html) {
  if (!html) return "";

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  return text.trim();
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
    const description = cleanHtml(extractTag(itemXml, "description"));
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
        year: "numeric",
      }),
      description: description.trim(),
      audioUrl,
      link,
      guid,
    });
  }

  return episodes;
}

/**
 * Extract episodes from doag.md frontmatter - robust parser
 */
function getExistingEpisodes() {
  const content = readFileSync(DOAG_MD_PATH, "utf-8");

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error("Could not parse frontmatter from doag.md");
  }

  const frontmatter = frontmatterMatch[1];
  const lines = frontmatter.split("\n");

  const episodes = [];
  let currentEpisode = null;
  let inEpisodesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect episodes section start
    if (line.match(/^episodes:\s*$/)) {
      inEpisodesSection = true;
      continue;
    }

    // Detect end of episodes section (new top-level field)
    if (inEpisodesSection && line.match(/^[a-z_]+:/) && !line.match(/^\s/)) {
      inEpisodesSection = false;
      if (
        currentEpisode &&
        currentEpisode.id &&
        currentEpisode.title &&
        currentEpisode.date
      ) {
        episodes.push(currentEpisode);
      }
      currentEpisode = null;
      continue;
    }

    if (!inEpisodesSection) continue;

    // Detect new episode (- id: pattern with 2-space indent)
    if (line.match(/^ {2}- id:\s*(\S+)/)) {
      if (
        currentEpisode &&
        currentEpisode.id &&
        currentEpisode.title &&
        currentEpisode.date
      ) {
        episodes.push(currentEpisode);
      }

      const idMatch = line.match(/^ {2}- id:\s*(\S+)/);
      currentEpisode = {
        id: idMatch[1],
        title: null,
        date: null,
        audioUrl: null,
      };
      continue;
    }

    if (!currentEpisode) continue;

    // Extract fields with 4-space indent
    if (line.match(/^ {4}title:\s*(.+)$/)) {
      const titleMatch = line.match(/^ {4}title:\s*(.+)$/);
      currentEpisode.title = titleMatch[1].trim();
    } else if (line.match(/^ {4}date:\s*(.+)$/)) {
      const dateMatch = line.match(/^ {4}date:\s*(.+)$/);
      currentEpisode.date = dateMatch[1].trim();
    } else if (line.match(/^ {4}audioUrl:\s*[>|]?\s*$/)) {
      // audioUrl is multiline, get next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^ {6}\S/)) {
          currentEpisode.audioUrl = lines[j].trim();
          i = j;
          break;
        } else if (lines[j].match(/^ {4}[a-z]/)) {
          // Hit next field
          break;
        }
      }
    }
  }

  // Don't forget the last episode
  if (
    currentEpisode &&
    currentEpisode.id &&
    currentEpisode.title &&
    currentEpisode.date
  ) {
    episodes.push(currentEpisode);
  }

  console.log(`📖 Parsing ${episodes.length} episodes from doag.md`);
  episodes.forEach((ep) => {
    // Strip quotes if present
    if (ep.title) ep.title = ep.title.replace(/^["'](.*)["']$/, "$1");
    if (ep.date) ep.date = ep.date.replace(/^["'](.*)["']$/, "$1");
    if (ep.audioUrl) ep.audioUrl = ep.audioUrl.replace(/^["'](.*)["']$/, "$1");

    console.log(`   └─ "${ep.title}" (${ep.date})`);
  });

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

    // Check if audio URL matches (most reliable)
    if (
      existing.audioUrl &&
      rssEpisode.audioUrl &&
      existing.audioUrl === rssEpisode.audioUrl
    ) {
      console.log(`   ✅ Audio URL match: "${rssEpisode.title}"`);
      return true;
    }

    // Check if titles match (fuzzy)
    if (
      normalizedRssTitle.includes(normalizedExistingTitle) ||
      normalizedExistingTitle.includes(normalizedRssTitle)
    ) {
      console.log(`   ✅ Title match: "${rssEpisode.title}"`);
      return true;
    }

    // Also check if the formatted date matches (with some tolerance for format differences)
    // Normalize dates for comparison (remove locale-specific markers)
    const normalizedRssDate = rssEpisode.pubDateFormatted
      .toLowerCase()
      .replace(/\.?\s*/g, " ")
      .trim();
    const normalizedExistingDate = existing.date
      .toLowerCase()
      .replace(/\.?\s*/g, " ")
      .trim();

    if (normalizedRssDate === normalizedExistingDate) {
      console.log(`   ✅ Date match: "${rssEpisode.title}" (${existing.date})`);
      return true;
    }

    // Debug: Log comparison details
    if (process.env.DEBUG_EPISODES === "true") {
      console.log(`   📋 Comparing "${rssEpisode.title}"`);
      console.log(`      RSS normalized: "${normalizedRssTitle}"`);
      console.log(`      Existing normalized: "${normalizedExistingTitle}"`);
      console.log(
        `      RSS date: "${rssEpisode.pubDateFormatted}" vs Existing: "${existing.date}"`
      );
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
        writeFileSync(process.env.GITHUB_OUTPUT, "missing_episode=\n", {
          flag: "a",
        });
      }
      process.exit(0);
    }

    console.log(`📝 Found ${missingEpisodes.length} missing episode(s):`);
    missingEpisodes.forEach((ep, idx) => {
      console.log(`   ${idx + 1}. "${ep.title}" (${ep.pubDateFormatted})`);
    });

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
