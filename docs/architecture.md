# Architecture Overview

This document gives a high-level map of how data and pages are structured in the website.

## Runtime Stack

- Astro for static site generation and routing
- Content collections for structured markdown/data
- External APIs/Notion integrations through local scripts

## Main Repository Areas

- src/pages: route definitions and page composition
- src/components: reusable UI components
- src/layouts: layout wrappers and shared page structure
- src/content: markdown content collections
- src/data: data files loaded into collections
- public: static assets
- src/assets: localized/generated image folders
- scripts: content sync pipelines with optional image localization

## Content Collections

The active collection configuration is in src/content.config.ts.

Current conceptual collections:

- articles
- members
- press
- siteMeta
- siteUpdates

## Data Flow

### Sites

1. Site metadata and relationships are stored in content files.
2. Site pages resolve data from collections and API data.
3. Map rendering uses PUBLIC_MAPBOX_TOKEN at runtime.

### Site Updates

1. sync-site-updates.js reads Notion database records.
2. Markdown files are written to src/content/site-updates.
3. sync-site-updates.js with --replace-images localizes photo URLs into src/assets/site-updates.

### Site Images

1. sync-sites.js creates/updates site markdown stubs.
2. sync-sites.js with --replace-images downloads and optimizes image assets.
3. Content frontmatter is updated to local image paths.

## Operational Notes

- Keep scripts and collection schemas aligned.
- If output paths change, update both script behavior and collection loaders.
- Keep docs in sync with code changes to reduce onboarding friction.
