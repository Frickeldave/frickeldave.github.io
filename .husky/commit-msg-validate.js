#!/usr/bin/env node

/**
 * Commit Validation Hook
 * 1. Validates commit message follows Conventional Commits
 * 2. Runs code quality checks (Prettier, ESLint, Vale)
 */

const { execSync } = require('child_process');

const commitEditMsgFile = process.argv[2];

if (!commitEditMsgFile) {
  console.error('❌ No commit message file provided');
  process.exit(1);
}

console.log('\n');
console.log('🚀 Commit Validation & Quality Checks');
console.log('======================================');
console.log('');

// Step 1: Validate commit message with commitlint
console.log('📝 Step 1: Validating Commit Message...');
console.log('');

try {
  execSync(`npx --no -- commitlint --edit "${commitEditMsgFile}"`, {
    stdio: 'inherit',
  });
  console.log('✅ Commit message validated!\n');
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

// Step 2: Code Quality Checks
console.log('💎 Step 2: Running Code Quality Checks...');
console.log('');

const checks = [
  {
    name: 'Prettier',
    command: 'npm run format',
    description: 'Code formatting',
  },
  {
    name: 'ESLint',
    command: 'npm run lint:check',
    description: 'Code quality & best practices',
  },
  {
    name: 'Vale',
    command: 'npm run prose',
    description: 'Prose & documentation style',
    optional: true,
  },
];

let hasErrors = false;

for (const check of checks) {
  console.log(`  🔍 ${check.name}`);
  try {
    execSync(check.command, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    console.log(`     ✅ ${check.description} passed`);
  } catch (error) {
    if (check.optional && error.message.includes('not found')) {
      console.log(`     ⚠️  ${check.name} not available - skipping`);
    } else {
      console.log(`     ❌ ${check.description} FAILED`);
      hasErrors = true;
      // Print the error details
      if (error.stdout) console.log('\n' + error.stdout);
      if (error.stderr) console.log('\n' + error.stderr);
    }
  }
}

console.log('');

if (hasErrors) {
  console.log('❌ QUALITY CHECKS FAILED!');
  console.log('');
  console.log('Fix the issues above and try again.');
  console.log('');
  process.exit(1);
}

console.log('🎉 All validations passed! Your commit is ready.');
console.log('');

