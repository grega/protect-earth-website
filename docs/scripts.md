# Scripts

This document describes the content sync scripts used by the website.

## Overview

Scripts are in `scripts/` and are intended to keep content files aligned with external systems:

- Protect Earth API for site data
- Notion for site updates
- Optional image download and optimization workflows

## Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Create local environment file:

```bash
cp .env.example .env
```

3. Populate required values in .env for Notion and Google integrations.

## Script Reference

### sync-sites.js

Command:

```bash
pnpm sync-sites
```

With image localization:

```bash
pnpm sync-sites:replace-images
```

Purpose:

- Fetches sites from `https://api.protect.earth/sites`
- Applies ignore list from script config
- Creates/updates local site markdown files
- Preserves existing local frontmatter values
- Always strips remote image URLs from frontmatter
- With `--replace-images`, rebuilds each site's local image list from API sources and rewrites frontmatter to local paths only

Primary output location:

- src/content/siteMeta

### sync-site-updates.js

Command:

```bash
pnpm sync-site-updates
```

With image localization:

```bash
pnpm sync-site-updates:replace-images
```

Required env vars:

- NOTION_API_KEY
- NOTION_SITE_UPDATES_DB_ID
- GOOGLE_SERVICE_ACCOUNT_EMAIL (only with `--replace-images`)
- GOOGLE_PRIVATE_KEY (only with `--replace-images`)

Purpose:

- Reads Site Updates from Notion database
- Converts fields + page blocks to markdown
- Writes one markdown file per update
- Optionally localizes remote photo URLs to `src/assets/site-updates` with `--replace-images`

Primary output location:

- src/content/site-updates
