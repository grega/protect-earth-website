# Protect Earth Website

This repository contains the public website for Protect Earth, built with Astro.

It includes:
- Editorial content (articles, team, press)
- Site metadata and map-driven site pages
- Site update content synced from Notion
- Utility scripts for syncing content and images

## Documentation

Use these docs as your starting point:

- Concepts: [docs/concepts.md](docs/concepts.md)
- Scripts: [docs/scripts.md](docs/scripts.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)

## Quick Start

1. Install dependencies

```
pnpm install
```

2. Create your local environment file

	cp .env.example .env

3. Start development server

	pnpm dev

4. Build production output

	pnpm build

## Core Concepts

Start here if you are new to this repository:
- Sites: [docs/concepts.md#sites](docs/concepts.md#sites)
- Site Updates: [docs/concepts.md#site-updates](docs/concepts.md#site-updates)
- Content Collections: [docs/concepts.md#content-collections](docs/concepts.md#content-collections)

## Scripts

Script workflows are documented in [docs/scripts.md](docs/scripts.md).

Common commands:
- pnpm sync-sites
- pnpm sync-sites:replace-images
- pnpm sync-site-updates
- pnpm sync-site-updates:replace-images

## Project Structure

High-level structure:

- src/pages: Astro routes
- src/layouts and src/components: page structure and reusable UI
- src/content: source content collections
- public: static assets
- src/assets: optimized local image assets for content
- scripts: content and media sync scripts
