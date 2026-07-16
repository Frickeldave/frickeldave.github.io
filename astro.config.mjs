import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import remarkCollapse from "remark-collapse";
import remarkToc from "remark-toc";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

/** Remark plugin: converts ```mermaid code blocks to raw HTML <pre class="mermaid">
 *  so Shiki never touches them and mermaid.js can render them client-side. */
function remarkMermaid() {
  return function (tree) {
    const replacements = [];
    function walk(node, parent, index) {
      if (node.type === "code" && node.lang === "mermaid") {
        replacements.push([parent, index, node.value]);
      }
      if (Array.isArray(node.children)) {
        node.children.forEach((child, i) => walk(child, node, i));
      }
    }
    walk(tree, null, -1);
    // Replace in reverse order to preserve indices
    for (const [parent, index, value] of replacements.reverse()) {
      parent.children[index] = {
        type: "html",
        value: `<pre class="mermaid">${value}</pre>`,
      };
    }
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://frickeldave.github.io",
  base: "/",
  output: "static", // GitHub Pages requires static output
  trailingSlash: "ignore",
  prefetch: {
    prefetchAll: true,
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Tailwind @apply is handled earlier in the pipeline; using esbuild avoids
      // lightningcss minify warnings for remaining @apply directives.
      cssMinify: "esbuild",
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
  },
  integrations: [
    react(),
    sitemap(),
    mdx(),
  ],
  markdown: {
    // Astro 7-compatible markdown plugin wiring.
    processor: unified({
      remarkPlugins: [
        remarkMermaid,
        remarkToc,
        [
          remarkCollapse,
          {
            test: "Table of contents",
          },
        ],
        remarkMath,
      ],
      rehypePlugins: [[rehypeKatex, {}]],
    }),
    shikiConfig: {
      themes: {
        // https://shiki.style/themes
        light: "light-plus",
        dark: "dark-plus",
      },
    },
    extendDefaultPlugins: true,
  },
});
