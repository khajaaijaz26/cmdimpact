# Changelog

This file records user-visible changes. CmdImpact has not published a stable release.

## `0.2.0-alpha.1` - 2026-09-06

### Added

- A globally deployable static Vercel dashboard that connects directly to user-owned runners without API or WebSocket rewrites.
- Exact runner-origin selection with HTTPS required remotely and loopback HTTP allowed for development.
- Signed, expiring bearer session tokens for cross-site API and WebSocket authentication; they default to the configured 12-hour browser-session lifetime, stay in `sessionStorage`, and never enter URLs.
- Direct-runner setup flags for the allowed dashboard origin and workspace path.
- Optional generic attention notifications while the dashboard remains open in a background tab.
- A tools panel for inserting or copying commands for real installed Git, package, GitHub, deploy, and AI-agent CLIs.
- Vercel CSP, anti-framing, MIME-sniffing, referrer, permissions, and cache headers.

### Changed

- Disabled idle and hard session expiry by default. Browser and phone closure no longer ends work; processes continue until explicitly ended, the shell exits, the runner restarts, or the host goes offline.
- Required review for every non-empty pasted command, not only multi-line or recognized destructive input.
- Reworked documentation around the static-dashboard/user-owned-runner architecture, direct-host permissions, Docker isolation, authentication storage, and deployment boundaries.
- Added `VERCEL_PROJECT_PRODUCTION_URL` as the canonical-site fallback when `PUBLIC_SITE_URL` is not set.
- Bumped package metadata from `0.2.0-alpha.0` to `0.2.0-alpha.1`.

### Security

- Kept the owner access token login-only and out of browser storage.
- Sent cross-site API authorization in a header and WebSocket authorization in a subprotocol instead of a query string.
- Kept all terminal credentials, commands, output, and metadata out of Vercel.
- Explicitly documented that session tokens remain bearer credentials, arbitrary CLIs use real shell permissions, static paste checks never prove safety, and indefinite sessions can continue consuming resources.
- Kept analytics, ad-network runtime, third-party scripts, and terminal-origin secrets out of the static dashboard.

### Known limitations

- PTY processes and in-memory scrollback do not survive runner or host restart.
- A runner supports one owner security boundary, not isolated public accounts.
- An expired cross-site session token requires another access-token login; copied stateless tokens cannot be individually revoked before expiry.
- Notifications require an open page; there is no closed-tab push delivery.
- Direct-host mode is unisolated, and Docker is not a hostile-code sandbox.

## `0.2.0-alpha.0` - 2026-09-06

### Added

- A self-hosted live PTY terminal for a single owner.
- Session creation, listing, reconnect, and termination while the server remains online.
- Cross-device reconnect to running sessions through the same self-hosted server.
- Guarded paste for multi-line or potentially destructive input.
- Docker-based terminal isolation and documented alpha limits.
- Responsive terminal and session-management interfaces.

### Changed

- Rebuilt the earlier command-impact checker into a working web terminal.
- Replaced the visual system and navigation with the new non-neon product design.
- Bounded session history to every non-exited record plus the 100 newest exited metadata records.

### Security

- Added a private vulnerability-reporting policy and terminal-specific contribution rules.
- Kept third-party runtime scripts off the entire terminal origin; guide sponsorship is static text and an HTTPS link only.

### Known limitations

- Sessions and terminal processes do not survive a server restart.
- The alpha supports one owner, not multiple isolated users.
- Managed cloud hosting and per-device revocation are not included.
