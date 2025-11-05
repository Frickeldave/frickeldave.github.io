import React, { useState, useMemo } from "react";
import type { HandmadeItem } from "@/types";

interface Props {
  items: HandmadeItem[];
  categories: string[];
  allTags: string[];
}

type SortOption = "price-asc" | "price-desc" | "name-asc" | "name-desc";

export default function HandmadeFilter({ items, categories, allTags }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter((item) =>
        selectedTags.every((tag) => item.tags.includes(tag))
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return sorted;
  }, [items, selectedCategory, selectedTags, searchQuery, sortBy]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTags([]);
    setSearchQuery("");
    setSortBy("name-asc");
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="glass rounded-lg p-4">
        <input
          type="text"
          placeholder="Suche nach Produkten, Beschreibung oder Tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
        />
      </div>

      {/* Filters and Sort */}
      <div className="glass rounded-lg p-6 space-y-4">
        {/* Category Filter */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Kategorie</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category ? null : category
                  )
                }
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedCategory === category
                    ? "bg-accent text-white shadow-lg"
                    : "glass-subtle hover:bg-white/20"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Tags Filter */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  selectedTags.includes(tag)
                    ? "bg-accent text-white shadow-lg"
                    : "glass-subtle hover:bg-white/20"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Sortierung</h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="price-asc">Preis (aufsteigend)</option>
            <option value="price-desc">Preis (absteigend)</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={clearFilters}
          className="w-full mt-4 px-4 py-2 rounded-lg glass-subtle hover:bg-white/20 transition-all"
        >
          Filter zurücksetzen
        </button>
      </div>

      {/* Results Count */}
      <div className="text-center opacity-80">
        {filteredAndSortedItems.length} von {items.length} Produkten
      </div>

      {/* Product Grid */}
      <div id="product-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredAndSortedItems.map((item) => (
          <div key={item.id} data-product-id={item.id} />
        ))}
      </div>

      {filteredAndSortedItems.length === 0 && (
        <div className="text-center py-12 glass rounded-lg">
          <p className="text-xl opacity-70">
            Keine Produkte gefunden. Versuche andere Filter.
          </p>
        </div>
      )}
    </div>
  );
}
