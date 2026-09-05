<p align="center">
  <img src="./public/logo.svg" width="300" height="60" alt="CmdImpact logo">
</p>

<h1 align="center">CmdImpact</h1>

<p align="center"><strong>Your terminal, wherever you work.</strong></p>

<p align="center">
  <a href="https://github.com/khajaaijaz26/cmdimpact/actions/workflows/ci.yml"><img alt="Validation status" src="https://github.com/khajaaijaz26/cmdimpact/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="Apache-2.0 license" src="https://img.shields.io/badge/license-Apache--2.0-315b78.svg"></a>
</p>

CmdImpact is an open-source, self-hosted web terminal. Start a real shell session, leave the browser, and reconnect from another browser or device while the CmdImpact server stays online.

> [!WARNING]
> CmdImpact `0.2` is a single-owner alpha that provides real shell access. It is not a managed cloud service or a multi-user security boundary. Sessions survive browser and device disconnects, but terminal processes do not survive a server or container restart.

## What works today

| Capability | `0.2` status |
| --- | --- |
| Live interactive PTY terminal | Included |
| Create, list, rename, reconnect, and terminate sessions | Included |
| Reconnect from another device while the server remains online | Included |
| Guard multi-line and potentially destructive paste | Included |
| Docker-based isolated deployment | Included and recommended |
| Preserve a terminal across server or container restart | Not supported |
| Multiple isolated users | Planned |
| Per-device registration and revocation | Planned |
| Managed cloud service | Planned |

The access token represents the single owner. Anyone who obtains it can control every CmdImpact session.

## How it works

```text
Browser or mobile browser
        |  authenticated HTTP + WebSocket
        v
CmdImpact session server
        |  live PTY registry + metadata-only state file
        v
Docker-isolated PTY and shell
```

The server keeps the PTY alive when a browser disconnects. Reconnecting clients attach to that same running session. Because the registry and PTY belong to the running server environment, restarting the server or container ends them.

## Quick start with Docker

Requirements: Node.js 22.12 or newer, npm, Docker, and Docker Compose.

```bash
git clone https://github.com/khajaaijaz26/cmdimpact.git
cd cmdimpact
npm install
npm run setup
npm start
```

Open <http://localhost:4321/app/>. The web container is bound to `127.0.0.1:4321`, so it is reachable only from the host by default. `npm run setup` adds terminal configuration when `.env` does not already contain it and generates a strong `TERMINAL_ACCESS_TOKEN`; treat that token like a password and never commit or post it.

`npm start` launches the supported Compose stack. `docker compose up --build` is the equivalent direct command.

The Compose volumes retain workspace files and session metadata when containers are recreated, but they do not keep PTY processes alive. `npm run docker:down` stops the stack without deleting those volumes. Do not run `docker compose down -v` unless you intend to delete the stored workspace and metadata.

Docker is the supported isolated path. Do not add privileged mode, the Docker socket, broad host mounts, or unnecessary network access to the terminal container.

## Reconnect from another device

Keep the CmdImpact server and its container running, then make it reachable through an HTTPS/WSS reverse proxy, private VPN, or an authenticated tunnel. Use the same owner access token on the other device.

Do not expose the development server or forward port `4321` directly to the public internet. The default container port is intentionally bound to `127.0.0.1:4321`. Per-device credentials and remote revocation are not part of `0.2`; rotate `TERMINAL_ACCESS_TOKEN` and restart CmdImpact if it may have been disclosed.

For a public production endpoint, configure the exact HTTPS origins in `TERMINAL_ALLOWED_ORIGINS` and place the resource-limited Compose stack behind an external HTTPS/WSS reverse proxy. This remains a single-owner alpha. Direct-host mode is for localhost development on Windows, macOS, or Linux; it is not the production isolation boundary.

For a private, cross-device endpoint, [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) is the shortest supported pattern. Install Tailscale on the server and each trusted device. With CmdImpact already running, publish its loopback listener inside your tailnet and read the HTTPS URL:

```bash
tailscale serve --bg http://127.0.0.1:4321
tailscale serve status
```

Replace the local origins in `.env` with that one exact HTTPS origin:

```dotenv
PUBLIC_SITE_URL=https://your-machine.your-tailnet.ts.net
TERMINAL_ALLOWED_ORIGINS=https://your-machine.your-tailnet.ts.net
TERMINAL_ALLOW_INSECURE_LOCALHOST=false
```

Recreate the terminal service, then use the reported HTTPS URL on every device:

```bash
docker compose up -d --build
```

Do not use a public Funnel for this single-owner alpha. After switching to HTTPS-only origins, use the tailnet URL on the server too; mixed HTTP and HTTPS origins are intentionally rejected.

## Host development

Docker is the supported isolation boundary. For faster UI and backend development on a trusted host, run these in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:ui
```

`npm run server` starts only the direct host backend. Host development does not provide Docker isolation and must not be exposed to another device.

## Configuration

`npm run setup` writes safe local defaults. Change only the settings required by your deployment.

Compose reads the token, exact origins, localhost escape hatch, session/time limits, cookie lifetime, and `TRUST_PROXY` from `.env`. It passes the token only to the trusted gateway, which derives the login verifier and removes the token from its live JavaScript environment before any shell starts. Host and Docker administrators can still inspect container configuration and are part of the trusted boundary. `TERMINAL_HOST`, `TERMINAL_PORT`, `TERMINAL_WORKSPACE`, and `TERMINAL_STATE_FILE` are direct-host settings; the supported container image fixes those values internally, so changing them in `.env` does not override Compose.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Public origin used for canonical, social, and sitemap URLs; defaults to localhost |
| `TERMINAL_ACCESS_TOKEN` | Required owner credential; minimum 20 characters |
| `TERMINAL_ALLOWED_ORIGINS` | Comma-separated exact browser origins; required for production |
| `TERMINAL_ALLOW_INSECURE_LOCALHOST` | Allows HTTP only for an all-loopback local deployment; never use with a public hostname |
| `TERMINAL_HOST`, `TERMINAL_PORT` | Server bind address and port |
| `TERMINAL_WORKSPACE` | Working directory exposed to terminal sessions |
| `TERMINAL_STATE_FILE` | Metadata-only session-state file |
| `TERMINAL_MAX_SESSIONS` | Maximum concurrent PTYs |
| `TERMINAL_IDLE_MINUTES` | Idle session lifetime |
| `TERMINAL_HARD_HOURS` | Maximum session lifetime |
| `TERMINAL_COOKIE_HOURS` | Owner-login cookie lifetime |
| `TRUST_PROXY` | Trust proxy headers only behind a proxy you control |
| `PUBLIC_SPONSOR_NAME`, `PUBLIC_SPONSOR_TEXT`, `PUBLIC_SPONSOR_URL` | Optional build-time, guide-only static sponsor message; all three required and URL must be HTTPS |

Changing `PUBLIC_SITE_URL` or sponsor settings requires rebuilding the web image.

## Guarded paste

CmdImpact pauses multi-line and potentially destructive pasted text for review before sending it to the PTY. This reduces accidental execution; it does not understand every shell construct or make a command safe. Read the complete paste and cancel anything unexpected.

## Security model

- `TERMINAL_ACCESS_TOKEN` is a bearer credential with full owner access.
- The token is accepted only by the login endpoint and exchanged for a signed, HttpOnly, SameSite cookie that is also Secure on HTTPS deployments. It is not placed in browser storage or a WebSocket URL.
- Mutating HTTP requests and WebSocket connections require an authenticated owner and an exact allowed origin.
- Terminal input and output pass through the self-hosted server and must be treated as sensitive.
- Live PTY state and bounded output scrollback are memory-only. `.data/sessions.json` keeps every non-exited record and the 100 newest exited metadata records; CmdImpact does not write terminal transcripts. The shell and commands can still write history, logs, and files into the persistent workspace.
- In the terminal container, the trusted Node gateway runs as UID 0 with only `KILL`, `SETUID`, and `SETGID`. Session metadata stays root-only, and the access token is never forwarded to a shell; a fixed `setpriv` launcher drops shells to UID/GID 10002, clears supplementary groups and inheritable/ambient capabilities, and applies `no-new-privileges`.
- Docker limits accidental host access but is not a guarantee against every hostile workload.
- No page on the terminal origin loads third-party runtime scripts. Optional guide sponsorship is escaped static text plus an HTTPS link.

Review [SECURITY.md](./SECURITY.md) before exposing CmdImpact beyond localhost. Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/khajaaijaz26/cmdimpact/security/advisories/new), never a public issue.

## Validate a checkout

```bash
npm run validate
npm run verify:container # with the Compose stack running
```

The same validation runs for every push and pull request.

## Project direction

The next priorities are durable supervised sessions, device registration and revocation, stronger isolation tests, and clearer recovery controls. Multi-user hosting and a managed cloud service come later because they require a substantially stronger trust boundary.

See the [roadmap](./ROADMAP.md) and [changelog](./CHANGELOG.md) for the honest current scope.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md). Bug reports must use harmless commands and sanitized output. Security findings belong in a private advisory.

## Sponsorship and privacy

Optional sponsorship may appear only as clearly labeled, first-party static text on selected guides. CmdImpact loads no sponsor scripts, pixels, images, cookies, or analytics. Any future ad network must live on a separate origin that is excluded from the terminal's allowed-origin list.

## License

Copyright 2026 Shaik Khaja Aijaz Ahmed and contributors. Licensed under the [Apache License 2.0](./LICENSE).
