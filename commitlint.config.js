module.exports = {
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
};
