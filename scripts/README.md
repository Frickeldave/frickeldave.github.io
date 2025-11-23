# Scripts Directory

Dieses Verzeichnis enthält Build- und Utility-Scripts für das Projekt.

## generate-version.ts

**Zweck**: Generiert automatisch Versionsinformationen basierend auf Git-State und Environment.

**Output**: `public/version.json`

**Wird ausgeführt**:
- Automatisch vor jedem Build (`prebuild` Hook)
- Automatisch bei `npm run dev`
- Manuell via `npm run generate-version`

**Version-Format**:
- Local: `v0.0.0-dev-{branch}-{commit}`
- Dev: `v{major}.{minor}.0-dev-{commit}`
- Production: `v{major}.{minor}.{patch}`

Siehe `docs/versioning.md` für Details zum Versioning-System.
