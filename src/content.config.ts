import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

// May also need to update /src/types/index.d.ts when updating this file
// When updating the set of searchable collections, update collectionList in /src/pages/search.astro

const searchable = z.object({
  title: z.string(),
  description: z.string().optional(),
  autodescription: z.boolean().default(true),
  draft: z.boolean().default(false),
});

const social = z.object({
  discord: z.string().optional(),
  email: z.string().optional(),
  facebook: z.string().optional(),
  github: z.string().optional(),
  instagram: z.string().optional(),
  linkedIn: z.string().optional(),
  pinterest: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
  youtube: z.string().optional(),
});

const authors = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.{md,mdx}",
    base: "./src/content/authors",
  }),
  schema: ({ image }) =>
    searchable.extend({
      email: z.string().optional(),
      image: image().optional(),
      imageAlt: z.string().default(""),
      social: social.optional(),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/blog" }),
  schema: ({ image }) =>
    searchable.extend({
      date: z.date().optional(),
      image: image().optional(),
      imageAlt: z.string().default(""),
      author: reference("authors").optional(),
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      complexity: z.number().default(1),
      hideToc: z.boolean().default(false),
    }),
});

const docs = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/docs" }),
  schema: ({ image }) =>
    searchable.extend({
      pubDate: z.date().optional(),
      modDate: z.date().optional(),
      image: image().optional(),
      imageAlt: z.string().default(""),
      hideToc: z.boolean().default(false),
      hideNav: z.boolean().default(false),
    }),
});

const home = defineCollection({
  loader: glob({ pattern: "-index.{md,mdx}", base: "./src/content/home" }),
  schema: ({ image }) =>
    z.object({
      image: image().optional(),
      imageAlt: z.string().default(""),
      title: z.string(),
      content: z.string(),
      button: z
        .object({
          label: z.string(),
          link: z.string().optional(),
        })
        .optional(),
    }),
});

const indexCards = defineCollection({
  loader: glob({
    pattern: "-index.{md,mdx}",
    base: "./src/content/index-cards",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    cards: z.array(z.string()),
  }),
});

const portfolio = defineCollection({
  loader: glob({
    pattern: "-index.{md,mdx}",
    base: "./src/content/portfolio",
  }),
  schema: ({ image }) =>
    searchable.extend({
      name: z.string().optional(),
      jobTitle: z.string().optional(),
      tagline: z.string().optional(),
      location: z.string().optional(),
      email: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
      instagram: z.string().optional(),
      website: z.string().optional(),
      summary: z.string().optional(),
      profileImage: image().optional(),
      intro: z
        .object({
          title: z.string(),
          content: z.string(),
        })
        .optional(),
      socialLinks: z
        .array(
          z.object({
            name: z.string(),
            url: z.string(),
            icon: z.string().optional(),
          })
        )
        .optional(),
      handmadeProjects: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            image: image().optional(),
            blogUrl: z.string().optional(),
            category: z.string().optional(),
          })
        )
        .optional(),
      publications: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            image: image().optional(),
            publicationUrl: z.string(),
            blogUrl: z.string().optional(),
            year: z.string().optional(),
            publisher: z.string().optional(),
          })
        )
        .optional(),
      skills: z
        .array(
          z.object({
            category: z.string(),
            technologies: z.array(z.string()),
          })
        )
        .optional(),
      experience: z
        .array(
          z.object({
            company: z.string(),
            position: z.string(),
            period: z.string(),
            location: z.string().optional(),
            responsibilities: z.array(z.string()).optional(),
          })
        )
        .optional(),
      projects: z
        .array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            github: z.string().optional(),
            demo: z.string().optional(),
            status: z.string().optional(),
            period: z.string().optional(),
            technologies: z.array(z.string()).optional(),
            content: z.array(z.string()).optional(),
          })
        )
        .optional(),
      education: z
        .array(
          z.object({
            degree: z.string(),
            institution: z.string(),
            year: z.string(),
          })
        )
        .optional(),
      achievements: z.array(z.string()).optional(),
      personalMotto: z.string().optional(),
      personalDescription: z.string().optional(),
      currentProject: z.string().optional(),
      careerJourney: z.string().optional(),
      personalInterests: z.array(z.string()).optional(),
      values: z.array(z.string()).optional(),
    }),
});

const recipes = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.{md,mdx}",
    base: "./src/content/recipes",
  }),
  schema: ({ image }) =>
    searchable.extend({
      date: z.date().optional(),
      image: image().optional(),
      imageAlt: z.string().default(""),
      author: reference("authors").optional(),
      prepTime: z.number().optional(),
      servings: z.number().optional(),
      diet: z.string().optional(),
      ingredients: z
        .object({
          list: z.array(z.string()),
          qty: z.array(z.string()),
        })
        .optional(),
      instructions: z.array(z.string()).optional(),
      notes: z.array(z.string()).optional(),
    }),
});

const terms = defineCollection({
  loader: glob({ pattern: "-index.{md,mdx}", base: "./src/content/terms" }),
  schema: searchable,
});

const downloads = defineCollection({
  loader: glob({ pattern: "-index.{md,mdx}", base: "./src/content/downloads" }),
  schema: searchable.extend({
    downloads: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          fileUrl: z.string(),
          fileSize: z.string().optional(),
          fileType: z.string().optional(),
          version: z.string().optional(),
          releaseDate: z.date().optional(),
          category: z.string().optional(),
        })
      )
      .optional(),
  }),
});

// Export collections
export const collections = {
  authors,
  blog,
  docs,
  downloads,
  home,
  indexCards,
  portfolio,
  recipes,
  terms,
};
