#!/usr/bin/env node

/**
 * Commit Message Validation Hook
 * Validates commit messages to follow Conventional Commits format
 */

const { execSync } = require('child_process');
const path = require('path');

const commitEditMsgFile = process.argv[2];

if (!commitEditMsgFile) {
  console.error('❌ No commit message file provided');
  process.exit(1);
}

try {
  // Run commitlint validation
  execSync(`npx --no -- commitlint --edit "${commitEditMsgFile}"`, {
    stdio: 'inherit',
  });

  console.log('\n✅ Commit message validated successfully!\n');
} catch (error) {
  console.log('\n');
  console.log('❌ COMMIT MESSAGE VALIDATION FAILED!\n');
  console.log('Your commit message does not follow Conventional Commits format.\n');
  console.log('FORMAT:');
  console.log('  <type>(<optional-scope>): <subject>\n');
  console.log('TYPES:');
  console.log('  feat     - A new feature');
  console.log('  fix      - A bug fix');
  console.log('  docs     - Documentation changes');
  console.log('  style    - Code style changes (formatting, semicolons)');
  console.log('  refactor - Code refactoring');
  console.log('  perf     - Performance improvements');
  console.log('  test     - Adding or updating tests');
  console.log('  ci       - CI/CD configuration changes');
  console.log('  chore    - Build tools, dependencies, etc.\n');
  console.log('EXAMPLES:');
  console.log('  ✅ feat(auth): add login page');
  console.log('  ✅ fix(sidebar): correct scrolling behavior');
  console.log('  ✅ docs: update README installation section');
  console.log('  ✅ ci: update GitHub Actions workflow\n');

  process.exit(1);
}
