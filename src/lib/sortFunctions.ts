import type { GenericEntry } from "@/types";

// Nach Datum sortieren
export const sortByDate = (entries: GenericEntry[]): GenericEntry[] => {
  const sortedEntries = entries.sort(
    (a: GenericEntry, b: GenericEntry) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Date((b.data as any).date && (b.data as any).date).valueOf() -
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Date((a.data as any).date && (a.data as any).date).valueOf()
  );
  return sortedEntries;
};

// Nach Titel sortieren
export const sortByTitle = (entries: GenericEntry[]): GenericEntry[] => {
  const sortedEntries = entries.sort((a: GenericEntry, b: GenericEntry) =>
    a.data.title.localeCompare(b.data.title)
  );
  return sortedEntries;
};

// Zufällig sortieren
export const sortByRandom = (entries: GenericEntry[]): GenericEntry[] => {
  const sortedEntries = entries.sort(() => Math.random() - 0.5);
  return sortedEntries;
};
