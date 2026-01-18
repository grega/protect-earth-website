import { defineCollection, z } from "astro:content";

const teamCollection = defineCollection({
  type: "data",
  schema: z.object({
    name: z.string(),
    role: z.string(),
    image: z.string(),
    bio: z.string(),
  }),
});

const pressArticlesCollection = defineCollection({
  type: "data",
  schema: z.object({
    title: z.string(),
    publication: z.string(),
    date: z.string(),
    url: z.string(),
  }),
});

const sitesCollection = defineCollection({
  type: "content",
  schema: z.object({
    fundingPartners: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const articlesCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string(),
    thumbnail: z.string().optional(),
  }),
});

export const collections = {
  team: teamCollection,
  "press-articles": pressArticlesCollection,
  sites: sitesCollection,
  articles: articlesCollection,
};
