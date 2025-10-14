import { slugify } from "@lib/textConverter";
import type { SearchableEntry } from "@/types";

const taxonomyFilter = (posts: SearchableEntry[], name: string, key: string) =>
  posts.filter((post) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taxonomyArray = (post.data as any)[name];
    if (!taxonomyArray || !Array.isArray(taxonomyArray)) {
      return false;
    }
    return taxonomyArray.map((name: string) => slugify(name)).includes(key);
  });

export default taxonomyFilter;
