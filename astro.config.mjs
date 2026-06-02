// @ts-check
import { defineConfig } from 'astro/config';
import yaml from '@rollup/plugin-yaml';
import netlify from '@astrojs/netlify';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://protect.earth',
	output: 'static',
	adapter: netlify(),

	redirects: {
		'/articles/deep-roots-ancient-woodlands-matter': '/articles/restoring-ancient-woodlands',
		'/articles/restoring-ancient-woodlands-a-practical-guide-from-high-wood':
			'/articles/restoring-ancient-woodlands',
		'/articles/misconception-planting-in-straight-lines-is-lazy-or-bad':
			'/articles/misconceptions-about-tree-planting',
		'/events/high-wood-summer-fair-14th-june-2026':
			'/events/high-wood-summer-fair-liskeard-cornwall-1986120946215.md',
		'/bath': '/warleigh-nature-reserve',
		'/blog/[slug]': '/articles/[slug]',
		'/projects/[slug]': '/sites/[slug]',
		'/blog': '/articles',
		'/donate': '/act-now/general-donation',
		'/projects': '/sites',
	},

	vite: {
		plugins: [yaml()],
	},

	integrations: [mdx(), sitemap()],
});
