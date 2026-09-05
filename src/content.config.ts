import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const source = z.object({
	title: z.string(),
	url: z.url(),
	publisher: z.string(),
	checked: z.string(),
});

const products = defineCollection({
	loader: file('src/data/products.json'),
	schema: z.object({
		id: z.string(),
		name: z.string(),
		brand: z.string(),
		model: z.string(),
		category: z.literal('Video doorbell'),
		summary: z.string(),
		region: z.string(),
		verifiedOn: z.string(),
		power: z.array(z.enum(['battery', 'wired', 'poe'])),
		network: z.array(z.enum(['wifi-2.4', 'wifi-5', 'ethernet'])),
		ecosystems: z.array(z.enum(['alexa', 'google-home', 'apple-home'])),
		ecosystemCoverage: z.enum(['verified', 'unknown']),
		storage: z.array(z.enum(['cloud', 'device', 'microSD', 'nvr', 'homebase'])),
		subscription: z.enum(['none', 'optional', 'recordings']),
		internet: z.enum(['required', 'limited-offline', 'unknown']),
		resolution: z.string(),
		fieldOfView: z.string(),
		weatherRating: z.string(),
		highlights: z.array(z.string()).min(2).max(4),
		limitations: z.array(z.string()).min(1).max(4),
		sources: z.array(source).min(1),
	}),
});

const guides = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/data/guides' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		publishedAt: z.coerce.date(),
		updatedAt: z.coerce.date(),
		readingTime: z.string(),
		topics: z.array(z.string()),
		featured: z.boolean().default(false),
	}),
});

export const collections = { products, guides };
