import type { GenericEntry } from "@/types";

const similerItems = (
  currentItem: GenericEntry,
  allItems: GenericEntry[],
  id: string
) => {
  let categories: string[] = [];
  let tags: string[] = [];

  // Kategorien setzen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((currentItem.data as any)?.categories?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories = (currentItem.data as any).categories;
  }

  // Tags setzen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((currentItem.data as any)?.tags?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags = (currentItem.data as any).tags;
  }

  // Nach Kategorien filtern
  const filterByCategories = allItems.filter((item: GenericEntry) =>
    categories.find((category) =>
      (item.data as { categories?: string[] }).categories?.includes(category)
    )
  );

  // Nach Tags filtern
  const filterByTags = allItems.filter((item: GenericEntry) =>
    tags.find((tag) => (item.data as { tags?: string[] }).tags?.includes(tag))
  );

  // nach dem Filtern zusammengeführt
  const mergedItems = [...filterByCategories, ...filterByTags];

  // Sich selbst aus der Liste entfernen
  const filterByID = mergedItems.filter((item) => item.id !== id);

  // Vorkommen jedes Items zählen
  const itemCount = filterByID.reduce(
    (accumulator: Record<string, number>, currentItem: GenericEntry) => {
      accumulator[currentItem.id] = (accumulator[currentItem.id] || 0) + 1;
      return accumulator;
    },
    {}
  );

  // Items nach Anzahl der Vorkommen sortieren
  const sortedItems = filterByID.sort(
    (a: GenericEntry, b: GenericEntry) => itemCount[b.id] - itemCount[a.id]
  );

  // Items mit weniger als 2 Vorkommen entfernen
  const filteredItems = sortedItems.filter(
    (item: GenericEntry) => itemCount[item.id] > 1
  );

  // Duplikate entfernen
  const uniqueItems = [
    ...new Set(filteredItems.map((item: GenericEntry) => item.id)),
  ].map((id: string) => {
    return filteredItems.find((item: GenericEntry) => item.id === id);
  });

  return uniqueItems;
};

export default similerItems;
