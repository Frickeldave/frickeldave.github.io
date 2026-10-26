import type { CollectionEntry, CollectionKey } from "astro:content";
import type { MarkdownHeading } from "astro";

export type GenericEntry = CollectionEntry<CollectionKey>;

export type AuthorsEntry = CollectionEntry<"authors">;
export type BlogEntry = CollectionEntry<"blog">;
export type DocsEntry = CollectionEntry<"docs">;
export type DownloadsEntry = CollectionEntry<"downloads">;
export type HomeEntry = CollectionEntry<"home">;
export type IndexCardsEntry = CollectionEntry<"indexCards">;
export type AboutMeEntry = CollectionEntry<"aboutme">;
export type RecipesEntry = CollectionEntry<"recipes">;

export type SearchableEntry =
  | AuthorsEntry
  | BlogEntry
  | DocsEntry
  | DownloadsEntry
  | AboutMeEntry
  | RecipesEntry;

export type SocialLinks = {
  discord?: string;
  email?: string;
  facebook?: string;
  github?: string;
  instagram?: string;
  linkedIn?: string;
  pinterest?: string;
  tiktok?: string;
  website?: string;
  youtube?: string;
};

export type EntryReference = {
  id: string;
  collection: string;
};

// Überschriften-Hierarchie definieren, damit wir das ToC erzeugen können
export interface HeadingHierarchy extends MarkdownHeading {
  subheadings: HeadingHierarchy[];
}

export type MenuItem = {
  title?: string;
  id: string;
  children: MenuItem[];
};

// Typ für Menüeinträge definieren, um verschachtelte Objekte zu erzeugen
export type MenuItemWithDraft = {
  title?: string;
  id: string;
  draft: boolean;
  visible: boolean;
  children: MenuItemWithDraft[];
};

// Props für die SideNavMenu-Komponente definieren
export type SideNavMenuProps = {
  items: MenuItemWithDraft[];
  level: number;
};

// Typen des Link-Redirect-Systems
export type LinkMapping = {
  title: string;
  description: string;
  targetUrl: string;
  provider: string;
  category: string;
  affiliate: boolean;
  openInNewTab: boolean;
  clicks: number;
  created: string;
  lastUpdated: string;
};

export type LinkMappings = {
  links: Record<string, LinkMapping>;
  analytics: {
    totalClicks: number;
    lastUpdated: string;
  };
};

// Typen der Handmade-Produkte
export type HandmadeItem = {
  articleNumber: string;
  name: string;
  description: string;
  picture: string;
  category: "3D-Druck" | "Holz" | "Laser" | "Epoxidharz";
  tags: string[];
  price: number;
  size?: string;
  visible: boolean;
  customizable: boolean;
};

export type HandmadeData = {
  products: HandmadeItem[];
};

export type SocialLinkTreeProfile = {
  name: string;
  handle?: string;
  tagline?: string;
  location?: string;
  avatar?: string;
  highlights?: string[];
};

export type SocialLinkTreeLink = {
  id: string;
  label: string;
  url: string;
  description?: string;
  badge?: string;
  icon?: string;
  color?: string;
};

export type SocialLinkTreeData = {
  profile: SocialLinkTreeProfile;
  links: SocialLinkTreeLink[];
  legal: {
    impressum: string;
    datenschutz: string;
  };
};
