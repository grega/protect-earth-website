#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import sharp from 'sharp';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Site configuration - keep in sync with src/config.ts
const ignoredSites = ['Burnsall', 'Donkeywell Farm', 'Newcastle Emlyn', 'Wraxall'];

const replaceImages = process.argv.includes('--replace-images');

function isRemoteUrl(value) {
	return typeof value === 'string' && /^https?:\/\//.test(value);
}

function sanitizeLocalImagePaths(images) {
	if (!Array.isArray(images)) {
		return [];
	}

	return images.filter((img) => typeof img === 'string' && !isRemoteUrl(img));
}

// Helper to convert to kebab-case
function toKebabCase(str) {
	return str
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/--+/g, '-')
		.trim();
}

function downloadImage(url, filepath) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(filepath);

		const handleResponse = (response) => {
			if (response.statusCode === 302 || response.statusCode === 301) {
				const redirectUrl = response.headers.location;
				if (!redirectUrl) {
					reject(new Error('Redirect response without location header'));
					return;
				}
				https.get(redirectUrl, handleResponse).on('error', reject);
				return;
			}

			response.pipe(file);
			file.on('finish', () => {
				file.close();
				resolve(filepath);
			});
		};

		https.get(url, handleResponse).on('error', (err) => {
			fs.unlink(filepath, () => {});
			reject(err);
		});
	});
}

async function processImage(inputPath, outputPath, maxWidth = 1200) {
	await sharp(inputPath)
		.rotate()
		.resize(maxWidth, null, {
			withoutEnlargement: true,
			fit: 'inside',
		})
		.jpeg({ quality: 85, progressive: true })
		.toFile(outputPath);
}

async function localizeSiteImages(site, slug, imagesDir, tempDir) {
	if (!site.images || !Array.isArray(site.images) || site.images.length === 0) {
		return [];
	}

	const siteImagesDir = path.join(imagesDir, slug);
	if (fs.existsSync(siteImagesDir)) {
		// Replace mode should produce a fresh local image set.
		fs.rmSync(siteImagesDir, { recursive: true, force: true });
	}

	if (!fs.existsSync(siteImagesDir)) {
		fs.mkdirSync(siteImagesDir, { recursive: true });
	}

	const localImages = [];

	for (let i = 0; i < site.images.length; i++) {
		const imageUrl = site.images[i];
		const imageNum = i + 1;
		const tempPath = path.join(tempDir, `${slug}-${imageNum}.jpg`);
		const localFileName = `${imageNum}.jpg`;
		const localPath = path.join(siteImagesDir, localFileName);
		const contentPath = `../../assets/sites/${slug}/${localFileName}`;

		try {
			await downloadImage(imageUrl, tempPath);
			await processImage(tempPath, localPath, 1200);
			localImages.push(contentPath);

			if (fs.existsSync(tempPath)) {
				fs.unlinkSync(tempPath);
			}
		} catch (error) {
			console.warn(`⚠️  Failed to localize image for ${slug}: ${imageUrl}`);
			console.warn(`   ${error.message}`);
			// Never preserve remote URLs in frontmatter.
		}
	}

	return localImages;
}

async function syncSites() {
	console.log('🌳 Syncing sites from API...');
	if (replaceImages) {
		console.log('🖼️  Image replacement enabled (--replace-images)');
	}

	try {
		// Fetch sites from API
		const response = await fetch('https://api.protect.earth/sites');
		if (!response.ok) {
			throw new Error(`API returned ${response.status}: ${response.statusText}`);
		}

		const allSites = await response.json();

		// Filter out ignored sites
		const sites = allSites.filter((site) => !ignoredSites.includes(site.name));

		console.log(`📊 Found ${sites.length} sites (${allSites.length - sites.length} ignored)`);

		// Path to site metadata content directory
		const sitesDir = path.join(__dirname, '../src/content/siteMeta');
		const imagesDir = path.join(__dirname, '../src/assets/sites');
		const tempDir = path.join(__dirname, '../.temp-images');

		// Ensure directory exists
		if (!fs.existsSync(sitesDir)) {
			fs.mkdirSync(sitesDir, { recursive: true });
		}

		if (replaceImages) {
			[imagesDir, tempDir].forEach((dir) => {
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			});
		}

		// Get existing site files
		const existingFiles = new Set(
			fs
				.readdirSync(sitesDir)
				.filter((file) => file.endsWith('.md'))
				.map((file) => file.replace('.md', '')),
		);

		let createdCount = 0;
		let updatedCount = 0;
		let skippedCount = 0;

		// Create or update markdown files for sites
		for (const site of sites) {
			const slug = toKebabCase(site.name);

			if (!slug) {
				console.warn(`⚠️  Skipping site with invalid name: ${site.name}`);
				continue;
			}

			const filePath = path.join(sitesDir, `${slug}.md`);
			const fileExists = existingFiles.has(slug);

			let frontmatter = { tags: [] };
			let content = '';

			// If file exists, read existing data to preserve it
			if (fileExists) {
				try {
					const fileContent = fs.readFileSync(filePath, 'utf8');
					const parsed = matter(fileContent);
					frontmatter = parsed.data;
					content = parsed.content;
				} catch (error) {
					console.warn(`⚠️  Could not parse ${slug}.md:`, error.message);
				}
			}

			const sanitizedExistingImages = sanitizeLocalImagePaths(frontmatter.images);
			if (sanitizedExistingImages.length > 0) {
				frontmatter.images = sanitizedExistingImages;
			} else {
				delete frontmatter.images;
			}

			if (replaceImages) {
				const localImages = await localizeSiteImages(site, slug, imagesDir, tempDir);
				if (localImages.length > 0) {
					frontmatter.images = localImages;
				} else {
					delete frontmatter.images;
				}
			}

			// Write the file
			const newContent = matter.stringify(content, frontmatter);
			fs.writeFileSync(filePath, newContent, 'utf8');

			if (fileExists) {
				console.log(`🔄 Updated: ${slug}.md`);
				updatedCount++;
			} else {
				console.log(`✅ Created: ${slug}.md`);
				createdCount++;
			}
		}

		console.log(`\n✨ Complete!`);
		console.log(`   Created: ${createdCount} new file(s)`);
		console.log(`   Updated: ${updatedCount} existing file(s)`);
		console.log(`   Skipped: ${skippedCount} site(s)`);

		if (replaceImages && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	} catch (error) {
		console.error('❌ Error syncing sites:', error.message);
		process.exit(1);
	}
}

syncSites();
