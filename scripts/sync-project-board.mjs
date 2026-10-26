#!/usr/bin/env node
/**
 * Synchronisiert GitHub-Issues auf das frickeldave.de-Projektboard (GitHub Projects V2).
 *
 * Labels sind die Quelle der Wahrheit; das Board ist eine Einbahn-Projektion.
 * Für jedes Issue leitet das Skript die Zielspalte aus seinen Labels ab und
 * verschiebt das zugehörige Projekt-Item dorthin (und legt es bei Bedarf vorher an).
 *
 * Spalten-Zuordnung (siehe .squad/routing.md und die Squad-Projektboard-Doku):
 *   Done          → Issue geschlossen
 *   In Progress   → go:yes + squad:{member}
 *   Ready         → go:yes (ohne squad:{member})
 *   Needs Research→ go:needs-research
 *   Backlog       → alles andere (go:no / noch kein Votum)
 *
 * Aufruf:
 *   node scripts/sync-project-board.mjs --issue <number>   # ein Issue synchronisieren
 *   node scripts/sync-project-board.mjs --all              # alle offenen Issues neu synchronisieren
 *   node scripts/sync-project-board.mjs --issue <n> --dry-run
 *
 * Benötigte Umgebung:
 *   SQUAD_PROJECT_TOKEN  PAT mit `project`-Scope (nie committet, nicht GITHUB_TOKEN)
 *
 * Optionale Umgebung (Defaults zielen auf das frickeldave.github.io-Setup):
 *   PROJECT_OWNER        GitHub-Benutzer, dem das Projekt gehört   (Default: Frickeldave)
 *   PROJECT_NUMBER       Projektnummer aus der Projekt-URL          (Default: 2)
 *   REPO_OWNER           Repository-Owner                           (Default: Frickeldave)
 *   REPO_NAME            Repository-Name                            (Default: frickeldave.github.io)
 */

const token =
  process.env.SQUAD_PROJECT_TOKEN ||
  process.env.GH_TOKEN ||
  process.env.GITHUB_TOKEN;

const PROJECT_OWNER = process.env.PROJECT_OWNER || 'Frickeldave';
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER || 2);
const REPO_OWNER = process.env.REPO_OWNER || 'Frickeldave';
const REPO_NAME = process.env.REPO_NAME || 'frickeldave.github.io';

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

// Logische Board-Spalten. Die physischen Optionsnamen auf dem Board werden pro Lauf
// aufgelöst, damit das Skript mit Squad- oder GitHub-Default-Spalten funktioniert.
const COLUMNS = {
  BACKLOG: 'Backlog',
  NEEDS_RESEARCH: 'Needs Research',
  READY: 'Ready',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

const OPTION_ALIASES = {
  [COLUMNS.BACKLOG]: ['backlog', 'todo', 'no status', 'triage', 'icebox'],
  [COLUMNS.NEEDS_RESEARCH]: ['needs research', 'research', 'investigat'],
  [COLUMNS.READY]: ['ready', 'approved'],
  [COLUMNS.IN_PROGRESS]: ['in progress', 'progress', 'doing'],
  [COLUMNS.DONE]: ['done', 'closed', 'complete'],
};

const args = process.argv.slice(2);
const mode = args.includes('--all') ? 'all' : 'issue';
const dryRun = args.includes('--dry-run');

const issueArgIndex = args.indexOf('--issue');
const issueNumber =
  mode === 'issue' && issueArgIndex !== -1
    ? Number(args[issueArgIndex + 1])
    : null;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`• ${message}`);
}

async function graphql(query, variables) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'squad-project-board-sync',
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json();

  if (body.errors) {
    throw new Error(
      body.errors
        .map((error) =>
          error.message
            ? error.message.replace(/\s+/g, ' ').trim()
            : JSON.stringify(error),
        )
        .join('; '),
    );
  }

  return body.data;
}

/** Löst die Projekt-Node-ID, das Single-Select-Feld Status und seine Optionen auf. */
async function resolveBoard() {
  const data = await graphql(
    `
      query ResolveBoard($login: String!, $number: Int!) {
        user(login: $login) {
          projectV2(number: $number) {
            id
            title
            fields(first: 50) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
                ... on ProjectV2Field {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `,
    { login: PROJECT_OWNER, number: PROJECT_NUMBER },
  );

  const project = data?.user?.projectV2;
  if (!project) {
    fail(
      `Project "${PROJECT_OWNER}#${PROJECT_NUMBER}" not found. ` +
        'Check PROJECT_OWNER/PROJECT_NUMBER and that the token has `project` scope.',
    );
  }

  const fields = project.fields?.nodes ?? [];
  const statusField =
    fields.find(
      (f) => f.name?.toLowerCase() === 'status' && Array.isArray(f.options),
    ) ||
    fields.find((f) => Array.isArray(f.options));

  if (!statusField) {
    fail(
      `Project "${project.title}" has no single-select Status field. ` +
        'Add a Status field to the board before syncing.',
    );
  }

  return { project, statusField };
}

/** Bildet einen logischen Spaltennamen auf eine vorhandene Option des Boards ab. */
function findOption(options, column) {
  const target = column.toLowerCase();
  const exact = options.find((o) => o.name.toLowerCase() === target);
  if (exact) return exact;

  const aliases = OPTION_ALIASES[column] ?? [target];
  for (const alias of aliases) {
    const match = options.find((o) => o.name.toLowerCase().includes(alias));
    if (match) return match;
  }
  return null;
}

/** Leitet die Zielspalte aus Labels und Zustand eines Issues ab. */
function resolveColumn(issue) {
  if (issue.state === 'CLOSED') return COLUMNS.DONE;

  const labelNames = (issue.labels?.nodes ?? []).map((l) => l.name);
  const hasGoYes = labelNames.includes('go:yes');
  const hasSquadMember = labelNames.some((l) => l.startsWith('squad:'));
  const hasNeedsResearch = labelNames.includes('go:needs-research');

  if (hasGoYes && hasSquadMember) return COLUMNS.IN_PROGRESS;
  if (hasGoYes) return COLUMNS.READY;
  if (hasNeedsResearch) return COLUMNS.NEEDS_RESEARCH;
  return COLUMNS.BACKLOG;
}

async function fetchIssue(number) {
  const data = await graphql(
    `
      query FetchIssue($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          issue(number: $number) {
            id
            number
            title
            state
            labels(first: 50) {
              nodes {
                name
              }
            }
          }
        }
      }
    `,
    { owner: REPO_OWNER, name: REPO_NAME, number },
  );

  const issue = data?.repository?.issue;
  if (!issue) {
    throw new Error(`Issue #${number} not found in ${REPO_OWNER}/${REPO_NAME}.`);
  }
  return issue;
}

async function listOpenIssues() {
  const data = await graphql(
    `
      query ListOpenIssues($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          issues(
            first: 100
            states: OPEN
            orderBy: { field: CREATED_AT, direction: ASC }
          ) {
            nodes {
              number
            }
          }
        }
      }
    `,
    { owner: REPO_OWNER, name: REPO_NAME },
  );

  return (data?.repository?.issues?.nodes ?? []).map((n) => n.number);
}

/** Findet das Projekt-Item (falls vorhanden), das zur Issue-Nummer gehört. */
async function findProjectItem(projectId, issueNumber) {
  const data = await graphql(
    `
      query FindProjectItem($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    number
                  }
                }
              }
            }
          }
        }
      }
    `,
    { projectId },
  );

  const items = data?.node?.items?.nodes ?? [];
  return (
    items.find((item) => item.content?.number === issueNumber)?.id ?? null
  );
}

async function addIssueToProject(projectId, issueNodeId) {
  const data = await graphql(
    `
      mutation AddItem($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(
          input: { projectId: $projectId, contentId: $contentId }
        ) {
          item {
            id
          }
        }
      }
    `,
    { projectId, contentId: issueNodeId },
  );

  return data?.addProjectV2ItemById?.item?.id;
}

async function setItemStatus(projectId, itemId, statusFieldId, optionId) {
  await graphql(
    `
      mutation SetStatus(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $optionId: String!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `,
    { projectId, itemId, fieldId: statusFieldId, optionId },
  );
}

async function syncIssue(issue, board, missingColumns) {
  const column = resolveColumn(issue);
  const option = findOption(board.statusField.options, column);

  if (!option) {
    missingColumns.add(column);
    log(`SKIP #${issue.number} — board is missing a "${column}" option`);
    return;
  }

  let itemId = await findProjectItem(board.project.id, issue.number);

  if (!itemId) {
    if (dryRun) {
      log(`DRY-RUN #${issue.number} — would add to board and set "${column}"`);
      return;
    }
    itemId = await addIssueToProject(board.project.id, issue.id);
    log(`#${issue.number} added to board (${board.project.title})`);
  }

  if (dryRun) {
    log(`DRY-RUN #${issue.number} — would move to "${column}"`);
    return;
  }

  await setItemStatus(
    board.project.id,
    itemId,
    board.statusField.id,
    option.id,
  );
  log(`#${issue.number} → "${option.name}"`);
}

function printMissingColumns(missingColumns) {
  if (missingColumns.size === 0) return;
  const names = [...missingColumns].map((c) => `"${c}"`).join(', ');
  console.error(
    `\n⚠️  The board is missing the following column(s): ${names}.\n` +
      `   Add them to the Status field on https://github.com/users/${PROJECT_OWNER}/projects/${PROJECT_NUMBER}/settings/fields ` +
      'or create them with `gh project field-create`.',
  );
  process.exitCode = 1;
}

async function main() {
  if (!token) {
    fail(
      'SQUAD_PROJECT_TOKEN is not set. Create a PAT with `project` scope and ' +
        'expose it as the SQUAD_PROJECT_TOKEN secret (see docs/features/fr007-project-board-sync.md).',
    );
  }

  if (mode === 'issue' && !issueNumber) {
    fail('Usage: node scripts/sync-project-board.mjs --issue <number>');
  }

  const board = await resolveBoard();
  const missingColumns = new Set();

  if (mode === 'all') {
    log(`Full re-sync — project "${board.project.title}"`);
    const numbers = await listOpenIssues();
    log(`Found ${numbers.length} open issue(s)`);
    for (const number of numbers) {
      const issue = await fetchIssue(number);
      await syncIssue(issue, board, missingColumns);
    }
  } else {
    const issue = await fetchIssue(issueNumber);
    await syncIssue(issue, board, missingColumns);
  }

  printMissingColumns(missingColumns);
  log('Sync complete.');
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
