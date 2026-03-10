// Ref: https://docs.astro.build/en/guides/content-collections/

// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';

// 2. Import loader(s)
import { glob, file } from 'astro/loaders';

// 3. Import Zod
import { z } from 'astro/zod';

// 4. Define a `loader` and `schema` for each collection
const members = defineCollection({
	loader: file('./src/data/team.yaml'),
	schema: z.array(
		z.object({
			name: z.string(),
			role: z.string(),
			image: z.string(),
			imageAlt: z.string().default(''),
			bio: z.string(),
		}),
	),
});

// 5. Export a single `collections` object to register your collection(s)
export const collections = { members };
