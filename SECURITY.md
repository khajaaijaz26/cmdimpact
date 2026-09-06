# Security Policy

CmdImpact provides a live shell. Treat an authenticated session as full access to the configured runner identity and all terminal data as sensitive.

## Supported versions

Security fixes are made only on the latest `0.2.x` alpha and the default branch.

| Version | Supported |
| --- | --- |
| Latest `0.2.x` / default branch | Yes |
| Earlier prototypes | No |

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/khajaaijaz26/cmdimpact/security/advisories/new). If that form is unavailable, email [khajaaijaz26@gmail.com](mailto:khajaaijaz26@gmail.com) with `[SECURITY]` in the subject. Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Include only what is needed to investigate:

- affected version or commit;
- dashboard and runner deployment details;
- impact and the documented boundary that was crossed;
- minimal reproduction using placeholder credentials and harmless commands;
- a suggested mitigation, if available.

Do not send live access tokens, bearer session tokens, cookies, private keys, private hostnames, personal data, or full terminal transcripts. We aim to acknowledge reports within 72 hours, then coordinate validation, remediation, credit, and disclosure with the reporter. This project does not operate a paid bug bounty.

## High-impact areas

Reports are especially valuable when they concern:

- access-token or expiring session-token authentication bypass;
- WebSocket subprotocol, origin, CORS, or authorization bypass;
- credential exposure through browser storage, URLs, headers, logs, Vercel, or terminal environments;
- terminal input reaching the wrong PTY or unauthorized session takeover;
- runner-origin validation bypass, including insecure non-loopback HTTP;
- command construction or injection outside the intended terminal stream;
- container, runner, filesystem, or host isolation escape;
- server-side request forgery or unintended private-network access;
- terminal output or metadata exposure;
- unauthorized persistence after logout or explicit session termination;
- denial of service that bypasses documented bounds.

Running arbitrary commands inside an authorized terminal is expected. It becomes a vulnerability when authentication, ownership, origin enforcement, isolation, or another documented boundary can be bypassed. A risky pasted command that static rules do not recognize is also an expected limitation unless the review step itself can be bypassed.

## Safe testing

Test only deployments and systems you own or have explicit permission to assess. Do not access another person's data, persist after demonstrating impact, perform social engineering, degrade shared infrastructure, or publish exploit details before a coordinated fix.

## Deployment responsibility

The public Vercel application is a static dashboard, not the terminal runner. It must contain no runner access token, bearer token, cookie secret, `/api` or `/ws` rewrite, analytics, ad-network runtime, or terminal traffic. The browser connects directly to the exact HTTPS runner origin selected by the owner.

Each owner operates a separate runner. Configure `TERMINAL_ALLOWED_ORIGINS` with the exact HTTPS dashboard origin. `TERMINAL_ALLOW_INSECURE_LOCALHOST` is only for all-loopback development. Keep the runner loopback-bound behind an HTTPS/WSS reverse proxy, VPN, or authenticated tunnel, and redact `Authorization`, `Cookie`, `Set-Cookie`, and `Sec-WebSocket-Protocol` from logs.

The owner access token is accepted only by the login endpoint and is never stored by the dashboard. Cross-site login returns a signed, expiring bearer token kept in `sessionStorage` and sent by header or WebSocket subprotocol, never by URL. Its lifetime follows `TERMINAL_COOKIE_HOURS` and defaults to 12 hours. It is still a bearer credential readable by code on the dashboard origin; logout cannot revoke a copied stateless token before expiry unless the access token is rotated and the runner restarted. Protect the browser, extension set, Vercel account, source repository, and build pipeline.

Docker reduces accidental host access but is not a security guarantee. Preserve the supported gateway/PTY identity split, limited capabilities, fixed `setpriv` drop, `no-new-privileges`, read-only application filesystem, and resource limits. Never expose privileged mode, the Docker socket, host files, devices, host networking, or sensitive networks to the runner. Direct-host mode uses the host user's real permissions and is not an isolation boundary.

`TERMINAL_IDLE_MINUTES=0` and `TERMINAL_HARD_HOURS=0` intentionally keep processes running after a browser or phone closes. Work ends only when the owner stops it, the shell exits, the runner restarts, or the host goes offline. Configure positive limits if unattended processes are unacceptable.

CmdImpact persists bounded session metadata but not terminal transcripts. Live PTYs and scrollback are memory-only and cannot survive a runner restart. Shells and commands can still write history, logs, credentials, source, and tool state into the workspace; operators control that data's access, backup, and deletion.

Read the complete [security model](./docs/SECURITY-MODEL.md) before exposing a runner beyond localhost.
