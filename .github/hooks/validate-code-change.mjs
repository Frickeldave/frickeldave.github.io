#!/usr/bin/env node
// validate-code-change.mjs
// PreToolUse Hook: Blockiert jede File-Edit-Operation solange kein
// Requirement-Engineer-Approval als GitHub Issue vorliegt.
//
// Workflow:
//   1. User schlägt Änderung vor
//   2. Requirement Engineer Agent (.github/agents/requirement-engineer.agent.md)
//      reviewt die Anforderung und erstellt ein GitHub Issue
//   3. REQ Engineer gibt das Ticket frei → Approval-File wird erstellt
//   4. PreToolUse Hook prüft das Approval-File und erlaubt die Edit-Operation
//
// Der REQ Engineer-Agent erstellt das Approval-File mit:
//   console.log("approved") > .github/hooks/approvals/current
//   # Optional: Issue-Nummer und Titel im File speichern
//   # printf "issue: GH-%s\ntitle: %s\n" "$ISSUE_NUM" "$TITLE" >> .github/hooks/approvals/current

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const APPROVAL_FILE = resolve(__dirname, "approvals/current");
const CONFIG_FILE = resolve(__dirname, "validate-code-change.json");
const MCP_CONFIG_FILE = resolve(ROOT, ".vscode/mcp.json");

// Blocked tools — File-Edit-Operationen UND Browser-Investigationstools
const BLOCKED_TOOLS = new Set([
  // File-Edit-Operationen
  "replace_string_in_file",
  "multi_replace_string_in_file",
  "create_file",
  "edit_notebook_file",
  "delete_file",
  // Browser-Investigationstools — verhindern Analyse ohne Approval
  "navigate_page",
  "open_browser_page",
  "screenshot_page",
  "read_page",
]);

// Funktion zur Prüfung, ob MCP-Server erreichbar sind
function checkMcpServers() {
  try {
    // Lese die Konfigurationsdatei
    if (!existsSync(CONFIG_FILE)) {
      console.error("Konfigurationsdatei nicht gefunden:", CONFIG_FILE);
      return false;
    }

    const configContent = readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(configContent);

    // Prüfe, ob MCP-Server definiert sind
    if (!config.mcpServers || config.mcpServers.length === 0) {
      return true; // Keine Server zu prüfen
    }

    // TODO: In einer späteren Implementierung werden wir hier die tatsächliche
    // Erreichbarkeit der MCP-Server prüfen
    // Für den Moment gehen wir davon aus, dass der GitHub MCP Server benötigt wird

    // Versuche, den GitHub MCP Server zu starten, falls er nicht läuft
    return startMcpServers(config.mcpServers);
  } catch (error) {
    console.error("Fehler beim Prüfen der MCP-Server:", error.message);
    return false;
  }
}

// Funktion zum Starten der MCP-Server
function startMcpServers(serverNames) {
  try {
    let allStarted = true;

    // Lese die MCP-Konfiguration
    if (!existsSync(MCP_CONFIG_FILE)) {
      console.error("MCP-Konfigurationsdatei nicht gefunden:", MCP_CONFIG_FILE);
      return false;
    }

    const mcpConfigContent = readFileSync(MCP_CONFIG_FILE, "utf-8");
    const mcpConfig = JSON.parse(mcpConfigContent);

    for (const serverName of serverNames) {
      console.log(`Prüfe MCP-Server: ${serverName}`);

      // Prüfe, ob der Server in der MCP-Konfiguration existiert
      if (!mcpConfig.servers || !mcpConfig.servers[serverName]) {
        console.error(
          `Server "${serverName}" nicht in .vscode/mcp.json konfiguriert`
        );
        allStarted = false;
        continue;
      }

      const serverConfig = mcpConfig.servers[serverName];

      // Für den GitHub Server versuchen wir, ihn zu starten
      if (serverName === "github") {
        // In einer echten Implementierung würden wir hier prüfen,
        // ob der Server bereits läuft, und nur dann starten
        // Momentan gehen wir davon aus, dass ein Startversuch nötig ist

        console.log(`Starte ${serverName} Server...`);
        // Wir führen das Kommando aus der MCP-Konfiguration aus
        const command = serverConfig.command;
        const args = serverConfig.args || [];

        // Hinweis: In einer echten Implementierung würden wir hier nicht
        // den Server synchron starten, da das den Hook blockieren würde
        // Stattdessen würden wir prüfen, ob der Server erreichbar ist
        console.log(
          `Server ${serverName} sollte jetzt gestartet werden mit: ${command} ${args.join(" ")}`
        );
        // In einer echten Implementierung:
        // const result = spawnSync(command, args, {
        //   cwd: ROOT,
        //   timeout: 5000,
        //   stdio: "pipe"
        // });
        // if (result.error || result.status !== 0) {
        //   console.error(`Fehler beim Starten von ${serverName}:`, result.error?.message || "Exit code " + result.status);
        //   allStarted = false;
        // }
      }
    }

    return allStarted;
  } catch (error) {
    console.error("Fehler beim Starten der MCP-Server:", error.message);
    return false;
  }
}

const ALLOW_DECISION = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
  },
};

const BLOCK_DECISION = (reason) => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

function output(decision) {
  process.stdout.write(JSON.stringify(decision) + "\n");
}

// ──────────────────────────────────────────────
// 1. Hook-Input (stdin) parsen — Tool-Namen extrahieren
// ──────────────────────────────────────────────
let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let tool = "";
  try {
    const data = JSON.parse(raw);
    tool = data.tool_name || data.toolName || data.tool || "";
  } catch {
    // Unparseable JSON → fallback to empty
  }

  // ──────────────────────────────────────
  // 2. Nur File-Edit-Operationen prüfen
  // ──────────────────────────────────────
  if (!BLOCKED_TOOLS.has(tool)) {
    // Keine Edit-Operation → sofort erlauben
    output(ALLOW_DECISION);
    return;
  }

  // ──────────────────────────────────────
  // 2b. MCP-Server prüfen
  // ──────────────────────────────────────
  if (!checkMcpServers()) {
    output(
      BLOCK_DECISION(
        "⚠️  MCP-Server nicht verfügbar. " +
          "Bitte stellen Sie sicher, dass alle erforderlichen MCP-Server gestartet sind. " +
          "Verwenden Sie 'GitHub Copilot: Configure GitHub Models' in der Befehlspalette von VSCode."
      )
    );
    return;
  }

  // ──────────────────────────────────────
  // 3. Approval prüfen
  // ──────────────────────────────────────
  if (!existsSync(APPROVAL_FILE)) {
    output(
      BLOCK_DECISION(
        "🛑 GEBLOCKT: Vor jeder File-Edit- oder Browser-Investigations-Operation muss ein validiertes GitHub Issue + Requirement Engineer Approval vorliegen. " +
          "Keine Approval-Datei gefunden (.github/hooks/approvals/current). " +
          "Der Requirement Engineer Agent muss das Ticket zuerst reviewen und freigeben."
      )
    );
    return;
  }

  const content = readFileSync(APPROVAL_FILE, "utf-8");

  if (!content.includes("issue:")) {
    output(
      BLOCK_DECISION(
        "⚠️ Approval-Datei (.github/hooks/approvals/current) existiert, enthält aber keine Issue-Referenz. " +
          "Der Requirement Engineer Agent muss das Ticket mit Issue-Nummer freigeben."
      )
    );
    return;
  }

  // ──────────────────────────────────────
  // 4. Expiry prüfen
  // ──────────────────────────────────────
  const expiresMatch = content.match(/^expires:\s*(.+)$/m);
  if (expiresMatch) {
    const expiresAt = new Date(expiresMatch[1].trim());
    if (!isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime()) {
      output(
        BLOCK_DECISION(
          `🕐 Approval abgelaufen (expires: ${expiresMatch[1].trim()}). ` +
            "Ein neues Requirement Engineer Approval muss eingeholt werden."
        )
      );
      return;
    }
  }

  output(ALLOW_DECISION);
});
