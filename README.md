# CompatNavi

**Find the tech that fits.**

CompatNavi turns verified manufacturer specifications into practical compatibility verdicts. The launch edition covers smart video doorbells and checks power, network, ecosystem, recording, subscription and internet-outage requirements.

## What is included

- Personal fit checker with Fits, Fits with limits, Doesn't fit and Unknown verdicts
- 12-product launch catalog with direct manufacturer sources and review dates
- Search and filters, side-by-side comparison and true ownership-cost calculator
- Five original decision guides
- Responsive light/dark UI, keyboard navigation and reduced-motion support
- Sitemap, robots file, social card, custom 404 and Cloudflare security headers
- Privacy, terms, methodology, corrections and advertising policies
- AdSense-ready slots that render nothing until real credentials are configured
- Unit checks, Astro type/content validation, production build and GitHub CI
- Cloudflare Workers static-assets configuration

## Stack

- Astro 7 with strict TypeScript
- Astro content collections with Zod validation
- Semantic HTML, native CSS and small browser scripts
- Node's built-in test runner
- Cloudflare Workers Static Assets via Wrangler

There is no UI framework, account system, database or CMS in v1. The site builds to static files.

## Run locally

Requirements: Node.js 24 or a compatible Node version listed in `package.json`, plus npm.

```bash
git clone https://github.com/khajaaijaz26/compatnavi.git
cd compatnavi
npm install
npm run dev
```

Open the URL printed by Astro, normally <http://localhost:4321>.

This repository's Astro agent instructions also support the background server commands:

```bash
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop
```

## Validate the complete project

```bash
npm run validate
```

That command runs:

1. `astro check` for TypeScript, Astro templates and content schemas;
2. Node tests for verdict and cost rules;
3. the optimized static production build.

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run check` | Astro and TypeScript checks |
| `npm test` | Rule-engine tests |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run deploy` | Validate a build and deploy static assets with Wrangler |

## Project map

```text
src/
  components/       Shared header, footer, product card and optional ad slot
  data/
    products.json   Normalized catalog and source metadata
    guides/         Original Markdown guides
  layouts/          Site and policy-page layouts
  lib/              Pure fit and ownership-cost rules
  pages/            File-based routes and tools
  styles/           Global design system
tests/              Minimal executable rule checks
public/             Brand assets, crawler files and Cloudflare headers
wrangler.jsonc      Cloudflare Workers Static Assets deployment
```

## Update or add a product

Edit `src/data/products.json`. Every entry is validated by `src/content.config.ts` and must include:

- a stable ID and exact model name;
- normalized compatibility fields;
- region and verification date;
- useful limitations, not only marketing highlights;
- at least one direct official source with publisher and checked date.

Use `unknown` or an empty supported-value list when the cited source does not answer a relevant question. Do not infer support from a retailer listing, review or logo alone. Run `npm run validate` before committing.

## Advertising setup

Ads are intentionally disabled until the site is approved. After Google AdSense supplies real values:

1. copy `.env.example` to `.env`;
2. replace `PUBLIC_ADSENSE_CLIENT` and `PUBLIC_ADSENSE_SLOT` with the assigned values;
3. copy the exact AdSense publisher line into `public/ads.txt` (use `public/ads.txt.example` only as a format reminder);
4. configure Google's required consent-management flow for the regions served;
5. update the live privacy policy with the enabled vendors and choices;
6. rebuild and confirm every placement is labeled and separated from tool controls.

Never publish the placeholder publisher ID or rename the example file without replacing its contents.

## Deploy to Cloudflare Workers

Wrangler is installed and `wrangler.jsonc` points to the static `dist/` directory.

```bash
npx wrangler login
npm run deploy
```

Then add the production domain in the Cloudflare dashboard and point it to the `compatnavi` Worker. The configuration serves the nearest generated `404.html` for missing routes and applies rules from `public/_headers`.

The deploy command changes external Cloudflare state, so it is not part of local validation or GitHub CI.

## Production launch checklist

- Purchase or connect the final domain and confirm the canonical URL in `astro.config.mjs`
- Verify HTTPS, `robots.txt`, `sitemap-index.xml`, canonical tags and the 404 response
- Add the domain to Google Search Console and submit the sitemap
- Enable privacy-appropriate analytics only after updating the privacy disclosure
- Publish enough useful, original content and apply for AdSense
- Configure consent choices, real ad IDs and `ads.txt` only after approval
- Test ad spacing on mobile so ads cannot be mistaken for controls
- Schedule catalog source reviews and process correction issues

## Editorial boundary

CompatNavi is independent decision support. It does not sell products or guarantee installation, service availability or safety. Advertisers cannot buy rankings, facts or verdicts. Product and company names belong to their respective owners.
