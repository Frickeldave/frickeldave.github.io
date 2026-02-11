#!/usr/bin/env node

/**
 * Pre-Push Branch Name Validation Hook
 * Validates that branch names follow the convention: <type>/<optional-id>-<description>
 */

const { execSync } = require('child_process');

// Get current branch name
let branchName;
try {
  branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.error('❌ Could not determine branch name');
  process.exit(1);
}

// Main branches should not be pushed to
const protectedBranches = ['main', 'dev', 'develop', 'master'];
if (protectedBranches.includes(branchName)) {
  console.log('\n✅ Protected branch detected - skipping validation\n');
  process.exit(0);
}

// Valid branch types
const validTypes = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'ci',
  'chore',
];

// Branch name regex pattern: type/optional-id-description
// Examples: feat/new-feature, fix/123-bug-fix, docs/update-readme
const branchPattern = new RegExp(
  `^(${validTypes.join('|')})(/[a-z0-9]+-)?[a-z0-9]+(-[a-z0-9]+)*$`
);

if (!branchPattern.test(branchName)) {
  console.log('\n');
  console.log('❌ BRANCH NAME VALIDATION FAILED!\n');
  console.log(`Your branch name "${branchName}" does not follow the naming convention.\n`);
  console.log('FORMAT:');
  console.log('  <type>/<optional-ticket-id>-<description>\n');
  console.log('VALID TYPES:');
  console.log(`  ${validTypes.join(', ')}\n`);
  console.log('EXAMPLES:');
  console.log('  ✅ feat/user-authentication');
  console.log('  ✅ fix/123-pagination-bug');
  console.log('  ✅ docs/update-readme');
  console.log('  ✅ ci/github-actions-setup\n');
  console.log('RULES:');
  console.log('  • Use lowercase letters and numbers');
  console.log('  • Separate words with hyphens (kebab-case)');
  console.log('  • No spaces or underscores');
  console.log('  • Start with a valid type prefix\n');
  console.log('RENAME YOUR BRANCH:');
  console.log(
    `  git branch -m "${branchName}" "feat/your-new-name"\n`
  );
  process.exit(1);
}

console.log('✅ Branch name validation passed!\n');
