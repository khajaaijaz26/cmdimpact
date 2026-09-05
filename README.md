# CmdImpact

**Paste a command. See what it may install, download, delete, overwrite or expose.**

CmdImpact is a browser-only command preflight for text copied from ChatGPT, Claude, Codex, GitHub, Copilot, Gemini and other sources. It recognizes known Bash and PowerShell patterns, explains the possible impact in plain English and never executes the input.

## Included

- One clear checker on the home page—no account or setup
- Known package installation, download, deletion, overwrite, elevation, network and literal-secret checks
- Direct download-to-shell detection for patterns such as `curl | sh` and `iwr | iex`
- Line-level evidence with credential-shaped values redacted from reports
- Cautious results: “no supported warning found” never becomes a “safe” badge
- Copyable review questions for any AI assistant
- Three original, source-linked guides
- Responsive light/dark UI, keyboard focus, semantic HTML and reduced-motion support
- Sitemap, web manifest, custom 404, security headers and Cloudflare static deployment
- Optional advertising on guide pages only; the checker page never loads ad scripts
- Offline tests using Node's built-in test runner

## Stack

- Astro 7 with strict TypeScript
- Native HTML, CSS and browser JavaScript
- Node's built-in test runner
- Cloudflare Workers static assets

There is no UI framework, AI API, database, login, analytics SDK or shell runtime.

## Run locally

Requirements: Node.js 22.12 or newer and npm.

```bash
git clone https://github.com/khajaaijaz26/cmdimpact.git
cd cmdimpact
npm install
npm run dev
```

Open the URL printed by Astro, normally <http://localhost:4321>.

## Validate

```bash
npm run validate
```

This runs Astro's type/content checks, the deterministic checker tests and the production build.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run check` | Astro and TypeScript checks |
| `npm test` | Command-checker tests |
| `npm run build` | Optimized static build |
| `npm run preview` | Preview the production build |
| `npm run deploy` | Validate and deploy with Wrangler |

## Trust boundary

The checker caps input at 50,000 characters and performs deterministic text analysis. It cannot resolve aliases, expand variables, inspect a machine, fetch a remote script or prove that a command is safe. It should be one review step before execution, not a replacement for official documentation, source review, backups, least privilege or an isolated test environment.

Pasted text is not persisted or sent to a CmdImpact server. The checker page does not load AdSense. Theme preference is the only local browser value stored.

## Advertising

Ads are disabled unless real AdSense values are configured. When enabled, they load only on editorial guide pages.

1. Copy `.env.example` to `.env`.
2. Add the approved client and slot values.
3. Replace `public/ads.txt.example` with the exact network-provided `public/ads.txt` line.
4. Configure consent requirements for every served region.
5. Update the live privacy disclosure before launch.

Never add ad scripts to `/` or place advertising inside warnings, controls or evidence.

## Deploy

```bash
npx wrangler login
npm run deploy
```

Then connect the production domain in Cloudflare and verify HTTPS, the canonical URL, sitemap, headers, consent behavior and mobile layout.

## Contributing

Open an issue with the exact command, expected category and current result. Replace private hosts, usernames and credentials with placeholders before posting. New detectors require one focused regression test and wording that describes evidence without promising safety.
