import { slug } from "github-slugger";
import { marked } from "marked";

marked.use({
  mangle: false,
  headerIds: false,
});

// slugify
export const slugify = (content: string) => {
  return slug(content);
};

// markdownify
export const markdownify = (content: string, div?: boolean) => {
  return div ? marked.parse(content) : marked.parseInline(content);
};

// Bindestriche zu Leerzeichen, nur den ersten Buchstaben jedes Worts groß
export const upperHumanize = (content: string) => {
  if (!content) {
    return "";
  }
  return content
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/(^\w{1})|(\s{1}\w{1})/g, (match) => match.toUpperCase());
};

// Bindestriche zu Leerzeichen, alle Buchstaben klein
export const lowerHumanize = (content: string) => {
  if (!content) {
    return "";
  }
  return content.toLowerCase().replace(/-/g, " ");
};

// plainify
export const plainify = (content: string) => {
  const parseMarkdown = marked.parse(content);
  const filterBrackets = parseMarkdown.replace(/<\/?[^>]+(>|$)/gm, "");
  const filterSpaces = filterBrackets.replace(/[\r\n]\s*[\r\n]/gm, "");
  const stripHTML = htmlEntityDecoder(filterSpaces);
  return stripHTML;
};

// Entities für plainify entfernen
const htmlEntityDecoder = (htmlWithEntities: string) => {
  const entityList: { [key: string]: string } = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
  };
  const htmlWithoutEntities: string = htmlWithEntities.replace(
    /(&amp;|&lt;|&gt;|&quot;|&#39;)/g,
    (entity: string): string => {
      return entityList[entity];
    }
  );
  return htmlWithoutEntities;
};
