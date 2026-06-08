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
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const APPROVAL_FILE = resolve(ROOT, ".github/hooks/approvals/current");

// Blocked tools — alle File-Edit-Operationen
const BLOCKED_TOOLS = new Set([
  "replace_string_in_file",
  "multi_replace_string_in_file",
  "create_file",
  "edit_notebook_file",
  "delete_file",
]);

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
  // 3. Approval prüfen
  // ──────────────────────────────────────
  if (!existsSync(APPROVAL_FILE)) {
    output(
      BLOCK_DECISION(
        "🛑 CODE-ÄNDERUNG GEBLOCKT: Vor jeder File-Edit-Operation muss ein validiertes GitHub Issue + Requirement Engineer Approval vorliegen. " +
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
