# Security model

## Scope and trust boundaries

CmdImpact `0.2` is a single-owner alpha. A public static dashboard can connect many owners to their own independent runners, but one runner is not a tenant boundary for unrelated users.

The runner owner, runner host administrator, TLS reverse proxy, Node gateway, and container runtime are trusted. Vercel is trusted to serve the published static files faithfully, but it is deliberately outside the terminal data path. Terminal commands, output, pasted text, browser extensions, downloaded code, package registries, websites, and remote CLI services are untrusted.

```text
Vercel: static dashboard only
Browser: selected runner origin + expiring session credential
Runner: authentication, API, WebSocket, PTYs, bounded metadata
Shell: every file, credential, network, and permission available to its OS identity
```

No terminal credential belongs in Vercel. The static deployment has no API/WS rewrite, serverless PTY, analytics, or terminal environment variable. Browser traffic goes directly to the exact runner origin selected by the owner.

## Authentication and origin controls

- `TERMINAL_ACCESS_TOKEN` is the full-owner credential. The runner accepts it only at `POST /api/auth/login`, compares constant-size digests, derives its verifier, and removes the raw environment value before launching a shell.
- A successful login returns a signed, expiring bearer session token. Its lifetime follows `TERMINAL_COOKIE_HOURS` and defaults to 12 hours. The cross-site dashboard stores it in `sessionStorage` together with the selected runner origin; changing runners discards it. The access token is never stored.
- Cross-site API requests send the expiring token in `Authorization: Bearer ...`. Cross-site WebSockets send it as the `cmdimpact.auth.<token>` subprotocol. Neither credential is placed in a URL.
- Same-origin local deployments may use the signed, expiring, HttpOnly `SameSite=Strict` cookie. Production cookies are `Secure` and use the `__Host-` prefix.
- Every login, state-changing request, and WebSocket upgrade requires an exact `TERMINAL_ALLOWED_ORIGINS` match. CORS reflects an allowed origin; it never grants `*`.
- Production dashboard origins must use HTTPS. A production allowlist may also contain loopback HTTP when `TERMINAL_ALLOW_INSECURE_LOCALHOST=true`; every non-loopback HTTP origin is rejected.
- WebSocket authorization is checked again during heartbeats. Logout clears the caller's cookie and closes connected sockets.

Session tokens are stateless bearer credentials. Logout cannot revoke a copied token that is not currently connected; it remains usable until its configured expiry or until access-token rotation/restart changes the signing material. A malicious script on the dashboard origin, browser extension, or compromised device can read `sessionStorage`. Treat the published dashboard supply chain and user device as part of the owner boundary.

Reverse proxies and observability systems must redact `Authorization`, `Cookie`, `Set-Cookie`, and `Sec-WebSocket-Protocol`. The subprotocol keeps the token out of URLs, not out of every possible header log.

## Browser controls

- The runner URL parser accepts only an exact origin with no username, password, path, query, or fragment. Remote origins require HTTPS; loopback may use HTTP.
- Vercel security headers disable framing and MIME sniffing, set a no-referrer policy, and restrict camera, microphone, geolocation, payment, and USB APIs.
- The Content Security Policy allows same-origin application assets and deliberately permits outbound `https:`/`wss:` connections to user-selected runners plus loopback HTTP/WS for development.
- Because every owner can choose a different runner, CSP is not an exact runner allowlist. Client URL validation, TLS, runner authentication, and the runner's exact origin allowlist are the meaningful controls.
- The dashboard contains no analytics, Speed Insights, ad-network runtime, sponsor script, pixel, or third-party image. Optional sponsorship is escaped first-party static text plus an HTTPS link.

## Terminal and protocol controls

- Clients select a fixed shell identifier, not an executable path or argument list. The runner maps it to installed PowerShell/cmd paths on Windows and `/bin/bash` or `/bin/sh` on macOS/Linux.
- HTTP bodies, WebSocket frames, terminal input, names, dimensions, connection counts, session counts, input/output rates, scrollback, and socket backpressure are bounded. WebSocket compression is disabled.
- Only one attached client writes to a PTY. Another authenticated device can take control while prior clients remain read-only.
- Terminal input and output are absent from application logs and the metadata store. Scrollback exists only in bounded process memory; storage retains every non-exited record plus the 100 newest exited metadata records.
- Every non-empty paste requires review. Static rules flag known risk shapes but cannot interpret arbitrary shell semantics, aliases, scripts, downloaded programs, or tool behavior. No warning ever proves safety.
- Attention notifications are generic, require browser permission, and operate only while the page stays open in a background tab. The app-scoped notification worker has no fetch, cache, or push handler; there is no closed-tab notification path.

These controls follow the core recommendations in the [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).

## Process persistence and retention

`TERMINAL_IDLE_MINUTES=0` and `TERMINAL_HARD_HOURS=0` disable automatic session expiry by default. Closing a browser or phone does not stop a process. It continues until the owner ends it, the shell exits, the runner restarts, or the host goes offline.

That behavior improves continuity but also means unattended commands can keep changing data, using network resources, consuming paid API credits, or incurring deployment cost. Operators who need an automatic ceiling must set positive idle and hard limits.

Workspace files and bounded metadata can survive a runner/container recreation. Live PTYs, process memory, and scrollback do not survive runner or host restart. On startup, stale live metadata is marked exited. CmdImpact does not claim durable process recovery.

The application does not persist terminal transcripts, but shells and commands can write history, logs, secrets, source files, caches, CLI tokens, and tool state into the workspace or user profile. Those files follow the operator's backup and retention policy.

## Execution and isolation limits

- Direct-host mode executes as the host user with no command isolation. Every installed CLI uses that user's filesystem, network, cloud credentials, SSH keys, GitHub access, agent permissions, and billing context. Keep the runner loopback-bound behind a trusted HTTPS/WSS proxy.
- The Linux container reduces accidental host access, but the gateway and PTYs still share one container and outbound network. PTYs share UID/GID 10002 and the workspace, so one command may read or delete workspace data, terminate other PTYs, exhaust the container quota, or exfiltrate data entered into the shell.
- The trusted container gateway runs as UID 0 with only `KILL`, `SETUID`, and `SETGID`; metadata is root-only. A fixed `setpriv` launcher changes PTYs to UID/GID 10002, clears supplementary groups and inheritable/ambient capabilities, and applies `no-new-privileges`. The application filesystem is read-only and PIDs/CPU/RAM are bounded.
- A command that creates a new process session may escape ordinary PTY lifecycle cleanup. The container is not a hostile-code sandbox or a multi-tenant boundary.
- Outbound networking exists so Git, package managers, deployment tools, and agent CLIs can work. The alpha has no egress allowlist, malware scanner, private-network filter, provider permission broker, spend limit, or secret vault.
- CmdImpact does not preinstall or inject credentials for Claude, Codex, Vercel, cloud providers, or other vendors. Installing, authenticating, updating, and paying for each CLI is the owner's responsibility.

Docker documents that containers have [no CPU or memory constraints by default](https://docs.docker.com/engine/containers/resource_constraints/), so the supported Compose stack sets explicit limits. [Docker rootless mode](https://docs.docker.com/engine/security/rootless/) reduces daemon risk, and [gVisor](https://gvisor.dev/docs/) can add a stronger application-kernel boundary; neither turns this alpha into a reviewed public multi-tenant service.

## Production deployment checklist

### Static dashboard

1. Deploy only the generated `dist/` output to Vercel and retain the repository's security headers.
2. Use an HTTPS production domain. `PUBLIC_SITE_URL` is an optional non-secret canonical override; otherwise the Vercel production URL is used.
3. Do not configure `/api` or `/ws` rewrites, runner tokens, access-token secrets, analytics, Speed Insights, ad scripts, or third-party runtime code.
4. Protect the source, build pipeline, Vercel account, and domain because a compromised dashboard can target credentials entered by owners.

### Each runner

1. Put the loopback runner behind an HTTPS/WSS reverse proxy, private VPN, or authenticated tunnel; expose only that TLS endpoint.
2. Set `TERMINAL_ALLOWED_ORIGINS` to the exact deployed dashboard origin and keep `TERMINAL_ALLOW_INSECURE_LOCALHOST=false` for external deployments.
3. Generate a high-entropy access token, keep `.env` outside Git, and rotate/restart if disclosure is possible.
4. Redact authentication and WebSocket-protocol headers from proxy, CDN, and application telemetry.
5. Prefer the resource-limited Docker path. Never expose the Docker socket, privileged mode, broad host mounts, devices, host networking, or unnecessary private networks.
6. Decide whether indefinite default sessions are appropriate; configure positive idle/hard limits when required.
7. Back up only the workspace data the owner deliberately wants retained. Do not treat metadata as a transcript backup.
8. Run `npm run validate`, verify the released container boundary, and obtain an independent review for the actual host, proxy, tunnel, and network.

## Reporting

Do not include access tokens, cookies, bearer session tokens, private repository data, terminal transcripts, or real commands containing secrets in a public issue. Follow the private process in [SECURITY.md](../SECURITY.md).
