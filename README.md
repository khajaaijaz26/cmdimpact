# CompatNavi

**The compatibility layer for technology everywhere.**

CompatNavi maps a visitor's market, platforms and connections, then turns verified manufacturer specifications into practical compatibility verdicts. The product is worldwide and category-neutral; the first verified dataset covers smart video doorbells.

## What is included

- Private Tech Passport for any country, 17 currencies and major computing, mobile, smart-home, gaming and connection platforms
- Public technology atlas with honest live and queued coverage states
- Category-specific fit checker with Fits, Fits with limits, Doesn't fit and Unknown verdicts
- 12-product launch catalog with direct manufacturer sources, evidence regions and review dates
- Search, filters, side-by-side comparison and worldwide ownership-cost calculator
- Five original decision guides
- Completely responsive dark/light UI with keyboard navigation and reduced-motion support
- Sitemap, installable web manifest, robots file, custom 404 and Cloudflare security headers
- Privacy, terms, methodology, corrections and advertising policies
- AdSense-ready slots that render nothing until real credentials are configured
- Node rule checks, Astro validation, production build and GitHub CI

## Stack

- Astro 7 with strict TypeScript
- Astro content collections with Zod validation
- Semantic HTML, native CSS and small browser scripts
- Browser local storage for private profiles
- Node's built-in test runner
- Cloudflare Workers Static Assets via Wrangler

There is no UI framework, account system, database or CMS. The site builds to static files.

## Run locally

Requirements: Node.js 22.12 or newer and npm.

```bash
git clone https://github.com/khajaaijaz26/compatnavi.git
cd compatnavi
npm install
npm run dev
```

Open the URL printed by Astro, normally <http://localhost:4321>.

Background development server commands are also supported:

```bash
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop
```

## Validate the project

```bash
npm run validate
```

This runs Astro/TypeScript/content checks, the minimal rule tests and the optimized static build.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run check` | Astro and TypeScript checks |
| `npm test` | Rule-engine tests |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run deploy` | Validate and deploy with Wrangler |

## Product structure

The Tech Passport provides shared market and platform context. Compatibility rules remain category-specific so each verdict uses facts that actually matter to that product type. Current video-doorbell data lives in `src/data/products.json`; new categories should receive their own evidence schema and checker only when real catalog work begins.

Every published product requires an exact model, normalized compatibility fields, evidence region, verification date, useful limitations and at least one direct official source. Missing information stays `unknown` instead of being inferred from retailers, reviews or logos.

## Advertising

Ads are disabled until the site is approved. After AdSense supplies real values:

1. copy `.env.example` to `.env`;
2. set `PUBLIC_ADSENSE_CLIENT` and `PUBLIC_ADSENSE_SLOT`;
3. add the exact publisher line to `public/ads.txt`;
4. configure consent requirements for every region served;
5. update the live privacy disclosure; and
6. verify that ads remain clearly labeled and outside navigation, inputs, verdicts and source lists.

## Deployment

```bash
npx wrangler login
npm run deploy
```

Then connect the production domain in Cloudflare and verify HTTPS, canonical URLs, the sitemap, Search Console, consent behavior and mobile ad spacing. Live deployment and account activation are intentionally not part of local validation.

## Editorial boundary

CompatNavi is independent decision support. Advertisers cannot buy rankings, facts or verdicts. Product and company names belong to their respective owners.
