/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Eine neue Funktion hinzufügen
        'fix',      // Einen Bug beheben
        'docs',     // Dokumentation aktualisieren
        'style',    // Code-Stil (Leerzeichen, Formatierung, Semicolons)
        'refactor', // Code umstrukturieren ohne feat/fix
        'perf',     // Performance verbessern
        'test',     // Tests hinzufügen oder ändern
        'ci',       // CI/CD Konfiguration ändern
        'chore',    // Abhängigkeiten, Build-Tools, etc.
      ],
    ],
    'type-case': [2, 'always', 'lowercase'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
  prompt: {
    questions: {
      type: {
        description: 'Select the type of change that you are committing:\n',
        enum: {
          feat: 'A new feature',
          fix: 'A bug fix',
          docs: 'Documentation only changes',
          style: 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
          refactor: 'A code change that neither fixes a bug nor adds a feature',
          perf: 'A code change that improves performance',
          test: 'Adding missing tests or correcting existing tests',
          ci: 'Changes to CI/CD configuration files and scripts',
          chore: 'Changes to the build process or auxiliary tools and libraries such as documentation generation',
        },
      },
      scope: {
        description: 'What is the scope of this change (optional)?\n',
      },
      subject: {
        description: 'Write a short, imperative tense description of the change:\n',
      },
      body: {
        description: 'Provide a longer description of the changes (optional):\n',
      },
      isBreaking: {
        description: 'Are there any breaking changes?\n',
      },
      breakingBody: {
        description: 'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself:\n',
      },
      breaking: {
        description: 'Describe the breaking changes:\n',
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?\n',
      },
      issuesBody: {
        description: 'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself:\n',
      },
      issues: {
        description: 'Add issue references (e.g. "fixes #123", "closes #123, #456"):\n',
      },
    },
  },
};
