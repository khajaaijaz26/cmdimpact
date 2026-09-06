// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const vercelSite = process.env.VERCEL_PROJECT_PRODUCTION_URL
	? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
	: undefined;

// https://astro.build/config
export default defineConfig({
	site: process.env.PUBLIC_SITE_URL || vercelSite || 'http://localhost:4321',
	integrations: [sitemap()],
	build: { format: 'directory' },
	vite: {
		server: {
			proxy: {
				'/api': 'http://127.0.0.1:8787',
				'/ws': { target: 'ws://127.0.0.1:8787', ws: true },
			},
		},
	},
});
