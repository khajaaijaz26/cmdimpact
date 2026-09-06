<p align="center">
  <img src="./public/logo.svg" width="300" height="60" alt="CmdImpact logo">
</p>

<h1 align="center">CmdImpact</h1>

<p align="center"><strong>Your terminal, on every screen.</strong></p>

<p align="center">
  <a href="https://cmdimpact.vercel.app"><img alt="Open the live dashboard" src="https://img.shields.io/badge/live-dashboard-405fd2.svg"></a>
  <a href="https://github.com/khajaaijaz26/cmdimpact/actions/workflows/ci.yml"><img alt="Validation status" src="https://github.com/khajaaijaz26/cmdimpact/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="Apache-2.0 license" src="https://img.shields.io/badge/license-Apache--2.0-315b78.svg"></a>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkhajaaijaz26%2Fcmdimpact"><img alt="Deploy the dashboard with Vercel" src="https://vercel.com/button"></a>
</p>

CmdImpact is an open-source web terminal with a globally deployable dashboard and a runner you control. Start a real shell on your computer or isolated Docker host, close the browser, then reconnect from another phone, tablet, or computer while that runner stays online.

Live dashboard: **[cmdimpact.vercel.app](https://cmdimpact.vercel.app)**

> [!WARNING]
> CmdImpact `0.2` is a single-owner alpha with real shell access. It is not a managed terminal service or a multi-user security boundary. Anyone with a valid owner credential can run commands with the runner's permissions.

## What it does

| Capability | `0.2` status |
| --- | --- |
| Interactive PowerShell, cmd, bash, or sh terminal | Included when installed on the runner |
| Create, rename, reconnect to, and end sessions | Included |
| Keep work running after a tab, browser, or phone closes | Included while the runner and host stay online |
| Reconnect from another device | Included |
| Run Git, GitHub CLI, package managers, deploy CLIs, and AI-agent CLIs | Uses the real installed commands and their permissions |
| Review every non-empty pasted command | Included; heuristic warnings never prove safety |
| Notify a background tab when a session needs attention | Included while the page remains open |
| Resume a PTY after the runner or host restarts | Not supported |
| Multiple isolated owners on one runner | Not supported |

CmdImpact does not imitate GitHub, Claude, ChatGPT, Codex, or deployment tools. It gives their real CLIs a reconnectable terminal. You install and authenticate each CLI on your runner, and its normal files, permissions, network access, and billing still apply.

## Architecture

```text
Any modern browser
        |
        | loads static HTML/CSS/JS
        v
Global Vercel dashboard
        |
        | direct HTTPS API + WSS to the exact origin you choose
        v
Your persistent CmdImpact runner
        |
        v
Real PTY -> real shell -> your projects and installed CLIs
```

Vercel serves only the static dashboard. It does not host the PTY, proxy `/api` or `/ws`, or receive the runner access token, terminal commands, or terminal output. The browser talks directly to the runner origin you enter.

Each person runs their own single-owner runner. Direct-host mode works on Windows, macOS, and Linux with the host user's permissions. The Linux Docker stack is the recommended isolation boundary for terminal workloads.

## Connect the global dashboard to your runner

Requirements: Node.js 22.12 or newer, npm, and an HTTPS/WSS reverse proxy or private tunnel for cross-device access.

On the computer that will keep the terminal processes alive:

```bash
git clone https://github.com/khajaaijaz26/cmdimpact.git
cd cmdimpact
npm install
npm run setup -- --origin https://YOUR-VERCEL-DOMAIN --workspace /path/to/projects
npm run server
```

`--origin` is the exact origin of the browser dashboard, such as `https://cmdimpact.example`. It is not the runner URL. A PowerShell path such as `C:\Users\you\Projects` also works for `--workspace`.

An external HTTPS dashboard origin makes setup write `NODE_ENV=production`. HTTP origins are accepted only for loopback development. Setup also creates `.env`, generates the owner access token, and keeps the runner bound to loopback by default.

Publish the runner through an HTTPS/WSS reverse proxy, private VPN, or authenticated tunnel that forwards to `http://127.0.0.1:8787`. Open the deployed dashboard, choose that exact runner origin—for example `https://runner.example.com`—and enter the access token printed by setup. The proxy must support WebSocket upgrades.

Do not forward port `8787` directly to the public internet. Direct-host mode runs every command as your host user and is not an isolation boundary.

## Local isolated start

For a private local evaluation with Docker and Docker Compose:

```bash
git clone https://github.com/khajaaijaz26/cmdimpact.git
cd cmdimpact
npm install
npm run setup
npm start
```

Open <http://localhost:4321/app/> and use the generated owner access token. The stack binds to `127.0.0.1:4321`, runs PTYs as a lower-privileged Linux user, and stores the workspace and bounded session metadata in named volumes.

The Docker workspace survives container recreation, but live terminal processes do not. `npm run docker:down` keeps the volumes. Do not run `docker compose down -v` unless you intend to delete their contents.

Do not add privileged mode, the Docker socket, broad host mounts, or unnecessary access to private networks. The container boundary reduces accidental host access; it is not a guarantee against hostile code.

To connect the isolated Compose runner from a Vercel dashboard, configure the dashboard origin and start the stack:

```bash
npm run setup -- --origin https://YOUR-VERCEL-DOMAIN
npm start
```

Publish `http://127.0.0.1:4321` through the runner's HTTPS/WSS proxy or trusted tunnel, then enter that external runner origin in the Vercel dashboard. Compose always uses its named `/workspace` volume; `--workspace` configures direct-host mode only.

## Sessions that outlive the browser

`TERMINAL_IDLE_MINUTES=0` and `TERMINAL_HARD_HOURS=0` are the defaults. Zero disables both automatic expiry limits, so closing a tab, browser, or phone does not end the PTY. A process keeps running until you end it, the shell exits, the runner restarts, or its host goes offline.

The runner retains bounded in-memory output for reconnecting clients and persists limited session metadata. It does not write terminal transcripts. Commands and shells may still write their own files, logs, history, credentials, and output into the workspace.

Set either limit to a positive integer if you prefer automatic cleanup. A runner restart cannot restore a `node-pty` process; stale metadata is marked exited honestly.

## Browser authentication

For a cross-site Vercel dashboard:

1. The chosen runner origin is stored in `localStorage`; it is not a credential.
2. The owner access token is sent only to `POST /api/auth/login` and is never stored by the dashboard.
3. Login returns a signed, expiring bearer session token scoped in the browser to that runner origin. Its default lifetime is 12 hours and follows `TERMINAL_COOKIE_HOURS`.
4. The session token is kept in `sessionStorage`, sent in the `Authorization` header for API calls, and carried in a WebSocket subprotocol—not a URL.
5. Session storage is scoped to that browser tab/session rather than a durable account store; browser restore behavior can preserve a restored tab. When the session token expires, the dashboard asks for the owner access token again, while the running PTY is unaffected.

Same-origin local deployments can also use the signed HttpOnly cookie. Every runner independently checks the exact browser `Origin`; wildcards are not used.

The bearer token is stateless. Logout closes currently connected sockets but cannot individually revoke a copied token before expiry; rotate the owner access token and restart the runner if disclosure is possible.

## Command review and attention alerts

Every non-empty terminal paste opens a review step before text reaches the PTY. Static checks highlight common destructive operations, secret-shaped values, downloads piped to shells, and similar risk. Shell syntax is too expressive for static rules to prove that any command is safe. Read the entire command and understand the target before running it.

Attention notifications are optional and generic. An app-scoped service worker displays alerts triggered by the open dashboard, but it has no fetch, cache, or push handler. Alerts require permission and the page to remain open; CmdImpact has no SMS, email, or delivery after the page is closed.

## Configuration

Run `npm run setup` to generate `.env`; never commit it. The runner accepts these settings:

| Variable | Purpose |
| --- | --- |
| `TERMINAL_ACCESS_TOKEN` | Required full-owner login credential; minimum 20 characters |
| `TERMINAL_ACCESS_TOKEN_FILE` | Optional file-based alternative for the runner secret |
| `TERMINAL_ALLOWED_ORIGINS` | Comma-separated exact dashboard origins; HTTPS required outside loopback |
| `TERMINAL_ALLOW_INSECURE_LOCALHOST` | Enables HTTP only for an all-loopback development deployment |
| `TERMINAL_HOST`, `TERMINAL_PORT` | Direct-runner bind address and port |
| `TERMINAL_WORKSPACE` | Directory exposed to direct-host terminal sessions |
| `TERMINAL_STATE_FILE` | Metadata-only session-state file |
| `TERMINAL_MAX_SESSIONS` | Maximum concurrent PTYs, from 1 to 16 |
| `TERMINAL_IDLE_MINUTES` | Detached-session timeout; `0` disables it |
| `TERMINAL_HARD_HOURS` | Absolute session timeout; `0` disables it |
| `TERMINAL_COOKIE_HOURS` | Browser session lifetime for the same-origin cookie and cross-site bearer token; defaults to 12 hours |
| `TRUST_PROXY` | Trust forwarding headers only behind a proxy you control |

The static dashboard recognizes these build-time values:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Optional canonical site override |
| `VERCEL_PROJECT_PRODUCTION_URL` | Automatic Vercel canonical fallback; CmdImpact adds `https://` |
| `PUBLIC_SPONSOR_NAME`, `PUBLIC_SPONSOR_TEXT`, `PUBLIC_SPONSOR_URL` | Optional first-party static sponsor text; all three required and the URL must use HTTPS |

There is deliberately no build-time default runner URL or terminal credential.

## Deploy only the dashboard to Vercel

Import this repository into Vercel or use the Deploy button above. `vercel.json` selects Astro, runs `npm run build`, publishes `dist/`, and applies the production security headers. No Astro server adapter or Vercel Function is needed.

Do not add runner secrets to Vercel. Do not add `/api` or `/ws` rewrites: a serverless function is not the persistent PTY runner. If you use a custom canonical domain, set `PUBLIC_SITE_URL=https://your-domain.example`; otherwise the build falls back to Vercel's production project URL.

The dashboard includes no analytics, Speed Insights, ad-network runtime, or third-party scripts. Its Content Security Policy permits outbound connections to HTTPS/WSS runner origins and loopback development origins because every user chooses a different runner. The client still rejects insecure remote runner URLs, and each runner enforces its own exact origin allowlist.

## Validate a checkout

```bash
npm run validate
npm run verify:container # with the Compose stack running
```

The same validation runs for every push and pull request.

## Security, roadmap, and contributing

Read the [security model](./docs/SECURITY-MODEL.md) and [security policy](./SECURITY.md) before making a runner reachable beyond localhost. Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/khajaaijaz26/cmdimpact/security/advisories/new), never a public issue.

Current limits and planned work are tracked in the [roadmap](./ROADMAP.md) and [changelog](./CHANGELOG.md). Contributions follow [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Sponsorship and privacy

Optional sponsorship is clearly labeled, first-party static text plus an HTTPS link. CmdImpact loads no sponsor scripts, pixels, cookies, images, analytics, or ad networks. A future advertising system must remain isolated from terminal credentials and traffic.

## License

Copyright 2026 Shaik Khaja Aijaz Ahmed and contributors. Licensed under the [Apache License 2.0](./LICENSE).
