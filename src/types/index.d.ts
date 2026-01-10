import type { CollectionEntry, CollectionKey } from "astro:content";
import type { MarkdownHeading } from "astro";

export type GenericEntry = CollectionEntry<CollectionKey>;

export type AuthorsEntry = CollectionEntry<"authors">;
export type BlogEntry = CollectionEntry<"blog">;
export type DocsEntry = CollectionEntry<"docs">;
export type DownloadsEntry = CollectionEntry<"downloads">;
export type HomeEntry = CollectionEntry<"home">;
export type IndexCardsEntry = CollectionEntry<"indexCards">;
export type PortfolioEntry = CollectionEntry<"portfolio">;
export type RecipesEntry = CollectionEntry<"recipes">;
export type TermsEntry = CollectionEntry<"terms">;

export type SearchableEntry =
  | AuthorsEntry
  | BlogEntry
  | DocsEntry
  | DownloadsEntry
  | PortfolioEntry
  | RecipesEntry
  | TermsEntry;

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

// Define heading hierarchy so that we can generate ToC
export interface HeadingHierarchy extends MarkdownHeading {
  subheadings: HeadingHierarchy[];
}

export type MenuItem = {
  title?: string;
  id: string;
  children: MenuItem[];
};

// Define the type for menu items to created nested object
export type MenuItemWithDraft = {
  title?: string;
  id: string;
  draft: boolean;
  children: MenuItemWithDraft[];
};

// Define the props for the SideNavMenu component
export type SideNavMenuProps = {
  items: MenuItemWithDraft[];
  level: number;
};

// Link redirect system types
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

// Handmade products types
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
