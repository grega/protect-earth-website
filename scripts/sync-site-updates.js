#!/usr/bin/env node
import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const replaceImages = process.argv.includes('--replace-images');

config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const SITE_UPDATES_DATABASE_ID = process.env.NOTION_SITE_UPDATES_DB_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!NOTION_API_KEY) {
	console.error('Error: NOTION_API_KEY environment variable is required');
	process.exit(1);
}

if (!SITE_UPDATES_DATABASE_ID) {
	console.error('Error: NOTION_SITE_UPDATES_DB_ID environment variable is required');
	process.exit(1);
}

if (replaceImages && (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY)) {
	console.error(
		'Error: GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are required with --replace-images',
	);
	process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

const drive = replaceImages
	? google.drive({
			version: 'v3',
			auth: new google.auth.GoogleAuth({
				credentials: {
					client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
					private_key: GOOGLE_PRIVATE_KEY,
				},
				scopes: ['https://www.googleapis.com/auth/drive.readonly'],
			}),
		})
	: null;

function toKebabCase(str) {
	return str
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/--+/g, '-')
		.trim();
}

function getRichText(richTextArray) {
	if (!Array.isArray(richTextArray)) return '';
	return richTextArray.map((text) => text.plain_text).join('');
}

function formatDate(dateString) {
	if (!dateString) return null;
	return new Date(dateString).toISOString();
}

function isRemoteUrl(value) {
	return typeof value === 'string' && /^https?:\/\//.test(value);
}

function isGoogleDriveLink(url) {
	return typeof url === 'string' && url.includes('drive.google.com');
}

function extractFolderId(url) {
	const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
	return match ? match[1] : null;
}

function downloadImage(url, filePath) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(filePath);

		const handleResponse = (response) => {
			if ([301, 302, 307, 308].includes(response.statusCode)) {
				const redirectUrl = response.headers.location;
				if (!redirectUrl) {
					reject(new Error('Redirect response without location header'));
					return;
				}
				https.get(redirectUrl, handleResponse).on('error', reject);
				return;
			}

			if (response.statusCode && response.statusCode >= 400) {
				reject(new Error(`HTTP ${response.statusCode}`));
				return;
			}

			response.pipe(file);
			file.on('finish', () => {
				file.close();
				resolve(filePath);
			});
		};

		https.get(url, handleResponse).on('error', (error) => {
			fs.unlink(filePath, () => {});
			reject(error);
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

async function fetchImagesFromDriveFolder(folderId, depth = 0) {
	if (!drive) return [];

	try {
		const response = await drive.files.list({
			q: `'${folderId}' in parents and trashed=false`,
			fields: 'files(id,name,mimeType)',
			pageSize: 100,
			supportsAllDrives: true,
			includeItemsFromAllDrives: true,
		});

		const files = response.data.files || [];
		let images = files.filter((file) => file.mimeType?.includes('image/'));

		if (depth < 2) {
			const folders = files.filter(
				(file) => file.mimeType === 'application/vnd.google-apps.folder',
			);
			for (const folder of folders) {
				const nested = await fetchImagesFromDriveFolder(folder.id, depth + 1);
				images = images.concat(nested);
			}
		}

		return images;
	} catch (error) {
		console.warn(`Warning: Could not fetch Google Drive folder ${folderId}: ${error.message}`);
		return [];
	}
}

async function localizeSiteUpdatePhotos(photos, slug, imagesDir, tempDir) {
	if (!photos || photos.length === 0) return [];

	const outputDir = path.join(imagesDir, slug);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const localized = [];
	let index = 1;

	for (const photoUrl of photos) {
		if (!isRemoteUrl(photoUrl)) {
			localized.push(photoUrl);
			continue;
		}

		if (isGoogleDriveLink(photoUrl)) {
			const folderId = extractFolderId(photoUrl);
			if (!folderId) {
				console.warn(`Warning: Could not extract Google Drive folder ID from ${photoUrl}`);
				continue;
			}

			const driveImages = await fetchImagesFromDriveFolder(folderId);
			for (const driveImage of driveImages) {
				const ext = driveImage.mimeType === 'image/png' ? 'png' : 'jpg';
				const tempPath = path.join(tempDir, `${slug}-${driveImage.id}.${ext}`);
				const localName = `${index}.jpg`;
				const localPath = path.join(outputDir, localName);
				const contentPath = `../../assets/site-updates/${slug}/${localName}`;

				if (fs.existsSync(localPath)) {
					localized.push(contentPath);
					index++;
					continue;
				}

				try {
					const response = await drive.files.get(
						{ fileId: driveImage.id, alt: 'media' },
						{ responseType: 'stream' },
					);

					const writer = fs.createWriteStream(tempPath);
					response.data.pipe(writer);
					await new Promise((resolve, reject) => {
						writer.on('finish', resolve);
						writer.on('error', reject);
					});

					await processImage(tempPath, localPath);
					localized.push(contentPath);
					index++;

					if (fs.existsSync(tempPath)) {
						fs.unlinkSync(tempPath);
					}
				} catch (error) {
					console.warn(
						`Warning: Failed to localize Drive image ${driveImage.name}: ${error.message}`,
					);
				}
			}
			continue;
		}

		const tempPath = path.join(tempDir, `${slug}-${index}.jpg`);
		const localName = `${index}.jpg`;
		const localPath = path.join(outputDir, localName);
		const contentPath = `../../assets/site-updates/${slug}/${localName}`;

		if (fs.existsSync(localPath)) {
			localized.push(contentPath);
			index++;
			continue;
		}

		try {
			await downloadImage(photoUrl, tempPath);
			await processImage(tempPath, localPath);
			localized.push(contentPath);
			index++;

			if (fs.existsSync(tempPath)) {
				fs.unlinkSync(tempPath);
			}
		} catch (error) {
			console.warn(`Warning: Failed to localize image ${photoUrl}: ${error.message}`);
		}
	}

	return localized;
}

async function getPropertyValue(property) {
	if (!property) return null;

	switch (property.type) {
		case 'title':
			return getRichText(property.title);
		case 'rich_text':
			return getRichText(property.rich_text);
		case 'select':
			return property.select?.name || null;
		case 'multi_select':
			return property.multi_select?.map((item) => item.name) || [];
		case 'date':
			return property.date?.start || null;
		case 'number':
			return property.number;
		case 'files':
			return (
				property.files?.map((file) => ({
					name: file.name,
					url: file.type === 'external' ? file.external?.url : file.file?.url,
				})) || []
			);
		case 'relation':
			return property.relation?.map((rel) => rel.id) || [];
		default:
			return null;
	}
}

function convertBlockToMarkdown(block) {
	if (!block) return '';

	switch (block.type) {
		case 'paragraph':
			return getRichText(block.paragraph.rich_text) + '\n\n';
		case 'heading_1':
			return '# ' + getRichText(block.heading_1.rich_text) + '\n\n';
		case 'heading_2':
			return '## ' + getRichText(block.heading_2.rich_text) + '\n\n';
		case 'heading_3':
			return '### ' + getRichText(block.heading_3.rich_text) + '\n\n';
		case 'bulleted_list_item':
			return '- ' + getRichText(block.bulleted_list_item.rich_text) + '\n';
		case 'numbered_list_item':
			return '1. ' + getRichText(block.numbered_list_item.rich_text) + '\n';
		case 'quote':
			return '> ' + getRichText(block.quote.rich_text) + '\n\n';
		case 'code': {
			const code = getRichText(block.code.rich_text);
			const lang = block.code.language || '';
			return '```' + lang + '\n' + code + '\n```\n\n';
		}
		case 'divider':
			return '---\n\n';
		default:
			return '';
	}
}

async function getPageContent(pageId) {
	try {
		const blocks = await notion.blocks.children.list({ block_id: pageId });
		return blocks.results.map((block) => convertBlockToMarkdown(block)).join('');
	} catch (error) {
		console.warn(`Warning: Could not fetch content for page ${pageId}: ${error.message}`);
		return '';
	}
}

async function syncSiteUpdates() {
	console.log('Syncing Site Updates from Notion...');
	if (replaceImages) {
		console.log('Image replacement enabled (--replace-images)');
	}

	try {
		const siteUpdatesDir = path.join(__dirname, '../src/content/site-updates');
		const imagesDir = path.join(__dirname, '../src/assets/site-updates');
		const tempDir = path.join(__dirname, '../.temp-images');

		if (!fs.existsSync(siteUpdatesDir)) fs.mkdirSync(siteUpdatesDir, { recursive: true });
		if (replaceImages) {
			if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
			if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
		}

		let allResults = [];
		let hasMore = true;
		let startCursor;

		while (hasMore) {
			const response = await notion.databases.query({
				database_id: SITE_UPDATES_DATABASE_ID,
				start_cursor: startCursor,
			});

			allResults = allResults.concat(response.results);
			hasMore = response.has_more;
			startCursor = response.next_cursor;
		}

		let createdCount = 0;
		let updatedCount = 0;

		for (const page of allResults) {
			const properties = page.properties;

			const title = await getPropertyValue(properties.Title || properties.Name);
			if (!title) continue;

			const type = await getPropertyValue(properties['Update Type']);
			const photos = await getPropertyValue(properties.Photos || properties.Images);
			const siteRelation = await getPropertyValue(
				properties['Sites'] || properties['🏝️ Sites'] || properties.Site,
			);
			const date = await getPropertyValue(properties['Update Date']);
			const treesPlanted = await getPropertyValue(properties['If new planting, how many trees?']);
			const survivalRate = await getPropertyValue(
				properties['If beatup survey, Alive % Survival rate?'],
			);
			const treesRestocked = await getPropertyValue(properties['If restocking, how many trees?']);

			const description = await getPageContent(page.id);
			const baseSlug = toKebabCase(title);
			const shortId = page.id.replace(/-/g, '').slice(-8);
			const slug = `${baseSlug}-${shortId}`;
			const filePath = path.join(siteUpdatesDir, `${slug}.md`);

			const notionPhotoUrls = (photos || []).map((p) => p.url).filter(Boolean);
			const photosToUse = replaceImages
				? await localizeSiteUpdatePhotos(notionPhotoUrls, slug, imagesDir, tempDir)
				: notionPhotoUrls;

			const frontmatter = {
				title,
				notionId: page.id,
				...(type && { type }),
				...(date && { date: formatDate(date) }),
				...(siteRelation?.length > 0 && { siteNotionId: siteRelation[0] }),
				...(treesPlanted != null && { treesPlanted }),
				...(survivalRate != null && { survivalRate }),
				...(treesRestocked != null && { treesRestocked }),
				...(photosToUse.length > 0 && { photos: photosToUse }),
			};

			let content = '---\n';
			content += Object.entries(frontmatter)
				.map(([key, value]) => {
					if (Array.isArray(value)) {
						return `${key}:\n${value.map((v) => `  - "${v}"`).join('\n')}`;
					}
					if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
						return `${key}: ${value}`;
					}
					return `${key}: "${value}"`;
				})
				.join('\n');
			content += '\n---\n\n';
			if (description) content += `${description}\n`;

			const existed = fs.existsSync(filePath);
			fs.writeFileSync(filePath, content, 'utf8');
			if (existed) {
				updatedCount++;
			} else {
				createdCount++;
			}
		}

		if (replaceImages && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}

		console.log('Complete');
		console.log(`Created: ${createdCount}`);
		console.log(`Updated: ${updatedCount}`);
		console.log(`Total: ${allResults.length}`);
	} catch (error) {
		console.error(`Error syncing site updates: ${error.message}`);
		process.exit(1);
	}
}

syncSiteUpdates();
