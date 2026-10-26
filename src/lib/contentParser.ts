import { getEntry, getCollection, type CollectionKey } from "astro:content";
import type { GenericEntry } from "@/types";

export const getIndex = async (
  collection: CollectionKey
): Promise<GenericEntry | undefined> => {
  const index = await getEntry(collection, "-index");
  return index;
};

export const getEntries = async (
  collection: CollectionKey,
  sortFunction?: (array: GenericEntry[]) => GenericEntry[],
  noIndex = true,
  noDrafts = true
): Promise<GenericEntry[]> => {
  let entries: GenericEntry[] = await getCollection(collection);
  entries = noIndex
    ? entries.filter((entry: GenericEntry) => !entry.id.match(/^-/))
    : entries;
  entries = noDrafts
    ? entries.filter(
        (entry: GenericEntry) =>
          // Im Dev-Modus (npm run dev) bleiben Draft- und versteckte Einträge für die
          // lokale Vorschau sichtbar. In Produktions-Builds erscheinen nur Einträge mit draft=false und visible=true.
          import.meta.env.DEV ||
          ("draft" in entry.data &&
            !entry.data.draft &&
            "visible" in entry.data &&
            entry.data.visible)
      )
    : entries;
  entries = sortFunction ? sortFunction(entries) : entries;
  return entries;
};

// Alle Seiten aller angegebenen Collections holen, flach zu einem Array zusammengefasst
export const getEntriesBatch = async (
  collections: CollectionKey[],
  sortFunction?: (array: GenericEntry[]) => GenericEntry[],
  noIndex = true,
  noDrafts = true
): Promise<GenericEntry[]> => {
  const allCollections = await Promise.all(
    collections.map(async (collection) => {
      return await getEntries(collection, sortFunction, noIndex, noDrafts);
    })
  );
  return allCollections.flat();
};

// Top-Level-Ordner innerhalb einer Collection holen
export const getGroups = async (
  collection: CollectionKey,
  sortFunction?: (array: GenericEntry[]) => GenericEntry[]
): Promise<GenericEntry[]> => {
  let entries = await getEntries(collection, sortFunction, false);
  entries = entries.filter((entry: GenericEntry) => {
    const segments = entry.id.split("/");
    return segments.length === 2 && segments[1] == "-index";
  });
  return entries;
};

// Einträge innerhalb der angegebenen Collection und Gruppe holen
export const getEntriesInGroup = async (
  collection: CollectionKey,
  groupSlug: string,
  sortFunction?: (array: GenericEntry[]) => GenericEntry[]
): Promise<GenericEntry[]> => {
  let entries = await getEntries(collection, sortFunction);
  entries = entries.filter((data: GenericEntry) => {
    const segments = data.id.split("/");
    return (
      segments[0] === groupSlug &&
      segments.length > 1 &&
      segments[1] !== "-index"
    );
  });
  return entries;
};
