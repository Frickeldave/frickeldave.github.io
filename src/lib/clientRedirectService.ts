// Clientseitige Link-Verwaltung für GitHub-Pages-Kompatibilität
// Ersetzt die serverseitigen API-Routen

import type { LinkMapping, LinkMappings } from "@/types";

// Link-Zuordnungen im Client speichern
let linkMappings: LinkMappings | null = null;

// Link-Zuordnungen aus statischem JSON initialisieren
export async function initializeLinkMappings(): Promise<void> {
  try {
    const response = await fetch("/data/link-mappings.json");
    linkMappings = await response.json();
  } catch (error) {
    console.error("Failed to load link mappings:", error);
    linkMappings = {
      links: {},
      analytics: {
        totalClicks: 0,
        lastUpdated: new Date().toISOString().split("T")[0],
      },
    };
  }
}

// Link anhand der ID holen
export function getLinkById(id: string): LinkMapping | null {
  if (!linkMappings) {
    console.error("Link mappings not initialized");
    return null;
  }

  const link = linkMappings.links[id];
  if (!link) {
    return null;
  }

  // Alt-Links ohne openInNewTab-Eigenschaft behandeln
  return {
    ...link,
    openInNewTab: link.openInNewTab ?? true, // Default to true
  };
}

// Klickzahl erhöhen (clientseitiger Speicher)
export function incrementClickCount(id: string): void {
  if (!linkMappings) {
    console.error("Link mappings not initialized");
    return;
  }

  if (!linkMappings.links[id]) {
    console.error("Link not found:", id);
    return;
  }

  // Aktuelle Zählerstände aus localStorage holen
  const stored = localStorage.getItem("linkClickCounts");
  const clickCounts = stored ? JSON.parse(stored) : {};

  // Zähler erhöhen
  clickCounts[id] = (clickCounts[id] || 0) + 1;

  // Zurück in localStorage schreiben
  localStorage.setItem("linkClickCounts", JSON.stringify(clickCounts));

  // Gesamtzahl der Klicks aktualisieren
  const totalClicks = Object.values(clickCounts).reduce(
    (sum: number, count) => sum + (count as number),
    0
  );
  localStorage.setItem("totalLinkClicks", totalClicks.toString());
  localStorage.setItem(
    "lastLinkUpdate",
    new Date().toISOString().split("T")[0]
  );
}

// Klickzahl für einen Link holen
export function getClickCount(id: string): number {
  const stored = localStorage.getItem("linkClickCounts");
  const clickCounts = stored ? JSON.parse(stored) : {};
  return clickCounts[id] || 0;
}

// Alle Analytics-Daten holen
export function getAnalytics(): {
  totalClicks: number;
  lastUpdated: string;
  linkCounts: Record<string, number>;
} {
  const stored = localStorage.getItem("linkClickCounts");
  const linkCounts = stored ? JSON.parse(stored) : {};

  const totalClicks = parseInt(localStorage.getItem("totalLinkClicks") || "0");
  const lastUpdated =
    localStorage.getItem("lastLinkUpdate") ||
    new Date().toISOString().split("T")[0];

  return {
    totalClicks,
    lastUpdated,
    linkCounts,
  };
}

// Link-Redirect behandeln
export async function handleLinkRedirect(
  id: string,
  referrer?: string
): Promise<void> {
  // Initialisieren, falls noch nicht geschehen
  if (!linkMappings) {
    await initializeLinkMappings();
  }

  const link = getLinkById(id);

  if (!link) {
    // Auf 404- bzw. Fehlerseite umleiten
    window.location.href = "/404";
    return;
  }

  // Klickzahl erhöhen
  incrementClickCount(id);

  // Bei Affiliate-Links die Offenlegungsseite zeigen
  if (link.affiliate) {
    const returnParam = referrer
      ? `&return=${encodeURIComponent(referrer)}`
      : "";
    window.location.href = `/redirect-info?id=${id}${returnParam}`;
    return;
  }

  // Bei Nicht-Affiliate-Links direkt umleiten
  if (link.openInNewTab) {
    window.open(link.targetUrl, "_blank");
  } else {
    window.location.href = link.targetUrl;
  }
}
