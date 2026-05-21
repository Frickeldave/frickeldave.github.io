#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// .env Datei laden
const loadEnv = () => {
  const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env"
  );
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `.env Datei nicht gefunden: ${envPath}\nVerwende .env.example als Template.`
    );
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};

  content.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const [key, ...valueParts] = line.split("=");
    if (key) {
      env[key.trim()] = valueParts.join("=").trim();
    }
  });

  return env;
};

const config = loadEnv();

const { LLM_API_URL, LLM_API_KEY, LLM_MODEL } = config;

if (!LLM_API_URL || !LLM_MODEL) {
  console.error(
    "❌ Fehler: LLM_API_URL und LLM_MODEL müssen in .env gesetzt sein!"
  );
  process.exit(1);
}

// Unterstützte Sprachen (muss VOR dem CLI-Parsing definiert sein)
const SUPPORTED_LANGS = {
  de: {
    name: "Deutsch",
    outputDir: "de",
    prompt: `Du bist ein professioneller Übersetzer für technische Dokumentation.
Übersetze den folgenden Text von Englisch nach Deutsch.
Behalte Markdown-Formatierung, Code-Blöcke, Links und alle Struktur-Elemente bei.
Übersetze nur den Text, nicht die Markdown-Syntax oder Variablen in Backticks.
Antworte NUR mit dem übersetzten Text, ohne weitere Erklärungen.`,
  },
  kl: {
    name: "Klingonisch (tlhIngan Hol)",
    outputDir: "kl",
    prompt: `Du bist ein professioneller Übersetzer für technische Dokumentation.
Übersetze den folgenden Text von Englisch nach Klingonisch (tlhIngan Hol).
Behalte Markdown-Formatierung, Code-Blöcke, Links und alle Struktur-Elemente bei.
Übersetze nur den Text, nicht die Markdown-Syntax oder Variablen in Backticks.
Antworte NUR mit dem übersetzten Text, ohne weitere Erklärungen.

WICHTIG: Klingonisch ist eine konstruierte Sprache aus dem Star Trek Universum.
Verwende authentische Klingonisch-Übersetzungen wo möglich.`,
  },
};

// CLI-Argumente verarbeiten (VOR der Sprachauswahl)
const args = process.argv.slice(2);

// Sprache aus CLI-Argumenten parsen
// Unterstützte Formate:
//   --lang=kl  (npm: npm run translate datei -- --lang=kl)
//   kl         (direkt: node script.mjs datei kl)
let cliLang = args.find((arg) => arg.startsWith("--lang="));
if (cliLang) {
  process.env.TARGET_LANG = cliLang.split("=")[1];
  args.splice(args.indexOf(cliLang), 1);
} else if (args.length >= 2 && SUPPORTED_LANGS[args[1]?.toLowerCase()]) {
  // Zweites Argument ist direkt ein Sprachcode (z.B. "kl")
  process.env.TARGET_LANG = args[1];
  args.splice(1, 1);
}

// Jetzt TARGET_LANG aus Environment oder .env laden (CLI hat Vorrang)
const TARGET_LANG = process.env.TARGET_LANG || config.TARGET_LANG || "de";

// Hilfsfunktion zum Aufruf des LLM
async function translateWithLLM(text, targetLangInfo) {
  const systemPrompt = targetLangInfo.prompt;

  try {
    const response = await fetch(`${LLM_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();

    // Prüfen ob die Antwort gültig ist
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error(`Ungültige API-Antwort: ${JSON.stringify(data)}`);
    }

    // Unterstützung für reasoning_content als Fallback (manche Modelle nutzen das statt content)
    const message = data.choices[0].message;
    const content = message.content || message.reasoning_content;

    if (!content) {
      throw new Error(`Leere Antwort vom Modell (Model: ${LLM_MODEL})`);
    }

    return content.trim();
  } catch (error) {
    throw new Error(`Fehler beim LLM-Aufruf: ${error.message}`);
  }
}

// Markdown Frontmatter und Inhalt trennen
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    return {
      frontmatter: match[1],
      body: match[2],
    };
  }

  return {
    frontmatter: null,
    body: content,
  };
}

// Hauptfunktion
async function translateMarkdown(inputFile, outputDir) {
  // Sprache validieren und targetLangInfo berechnen
  const langCode = TARGET_LANG.toLowerCase();
  if (!SUPPORTED_LANGS[langCode]) {
    console.error(
      `❌ Fehler: Sprache '${TARGET_LANG}' wird nicht unterstützt!\n` +
        `Unterstützte Sprachen: ${Object.entries(SUPPORTED_LANGS)
          .map(([code, info]) => `${code} (${info.name})`)
          .join(", ")}`
    );
    process.exit(1);
  }

  const targetLangInfo = SUPPORTED_LANGS[langCode];

  console.log(`📖 Lese Datei: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Datei nicht gefunden: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  console.log(`🔄 Übersetze zu ${targetLangInfo.name}...`);
  console.log("⏳ Dies kann ein paar Sekunden dauern...\n");

  let translatedBody;
  try {
    translatedBody = await translateWithLLM(body, targetLangInfo);
  } catch (error) {
    console.error(`❌ Übersetzung fehlgeschlagen: ${error.message}`);
    process.exit(1);
  }

  // Output-Pfad bestimmen
  const fileName = path.basename(inputFile);
  const outputDirCode = targetLangInfo.outputDir;

  // Wenn outputDir nicht übergeben, verwende paralleles Verzeichnis
  let finalOutputDir = outputDir;
  if (!finalOutputDir) {
    const inputDir = path.dirname(inputFile);
    finalOutputDir = path.join(
      inputDir,
      "..",
      outputDirCode,
      path.basename(path.dirname(inputFile))
    );
  }

  // Output-Verzeichnis erstellen
  fs.mkdirSync(finalOutputDir, { recursive: true });
  const outputFile = path.join(finalOutputDir, fileName);

  // Frontmatter + übersetzer Body kombinieren
  let outputContent = translatedBody;
  if (frontmatter) {
    outputContent = `---\n${frontmatter}\n---\n${translatedBody}`;
  }

  fs.writeFileSync(outputFile, outputContent, "utf-8");
  console.log(`✅ Erfolgreich gespeichert: ${outputFile}`);
  console.log(`\n📊 Statistik:`);
  console.log(`   Original-Zeilen: ${body.split("\n").length}`);
  console.log(`   Übersetzte Zeilen: ${translatedBody.split("\n").length}`);
}

// CLI-Argumente verarbeiten (bereits oben verarbeitet für --lang=)
// Hier prüfen wir nur noch ob eine Datei angegeben wurde
if (args.length === 0) {
  console.log(`
📖 Markdown-Übersetzungstool (mit OpenAI-kompatiblem LLM)

Verwendung:
  node scripts/translate.mjs <input-file> [output-dir]

Beispiele:
  node scripts/translate.mjs src/content/docs/en/guide.md
  node scripts/translate.mjs src/content/docs/en/guide.md src/content/docs/de/guides
  node scripts/translate.mjs src/content/docs/en/guide.md --lang=kl

Umgebungsvariablen (.env):
  - LLM_API_URL: OpenAI-kompatible API URL (z.B. http://localhost:11434/v1)
  - LLM_API_KEY: API-Schlüssel
  - LLM_MODEL: Model-Name (z.B. mistral, gpt-4-turbo, llama2)
  - TARGET_LANG: Zielsprache (Standard: de, Optionen: de, kl)

Unterstützte Sprachen:
  - de: Deutsch
  - kl: Klingonisch (tlhIngan Hol) - für Spaß-Zugabe!

Hinweis: CLI-Parameter --lang= überschreibt TARGET_LANG aus .env

Weitere Infos: siehe .env.example
	`);
  process.exit(0);
}

const inputFile = args[0];
const outputDir = args[1];

translateMarkdown(inputFile, outputDir).catch((error) => {
  console.error("❌ Kritischer Fehler:", error);
  process.exit(1);
});
