/**
 * OpenSCAD-Modell-Metadaten, erzeugt von `npm run scad:render`.
 * Gespeichert in `public/3dmodels/models.json`.
 */
export interface ScadModel {
  id: string;
  title: string;
  scadFile: string;
  stlFile: string;
}

/**
 * Props für die Astro-Komponente `ScadModelDisplay`.
 */
export interface ScadModelDisplayProps {
  id: string;
}
