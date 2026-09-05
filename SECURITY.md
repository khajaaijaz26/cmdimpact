# Security Policy

CmdImpact provides a live shell. Treat every authenticated terminal session as access to the configured runner and every terminal transcript as sensitive data.

## Supported versions

CmdImpact is a self-hosted alpha. Security fixes are made only on the latest `0.2.x` release and the default branch.

| Version | Supported |
| --- | --- |
| `0.2.x` / default branch | Yes |
| Earlier prototypes | No |

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/khajaaijaz26/cmdimpact/security/advisories/new). If that form is unavailable, email [khajaaijaz26@gmail.com](mailto:khajaaijaz26@gmail.com) with `[SECURITY]` in the subject. Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Include only the information needed to investigate:

- affected version or commit;
- deployment method and relevant environment details;
- impact and the security boundary that was crossed;
- minimal reproduction steps using placeholder credentials and harmless commands;
- any suggested mitigation.

Do not include live credentials, access tokens, private keys, private hostnames, personal data, or full terminal transcripts. We aim to acknowledge reports within 72 hours, then coordinate validation, remediation, credit, and disclosure with the reporter. This project does not currently operate a paid bug bounty.

## High-impact areas

Reports are especially valuable when they concern:

- authentication bypass, session takeover, or access to another owner's session;
- WebSocket origin or authorization bypass;
- terminal input reaching the wrong PTY;
- command construction or injection outside the intended terminal stream;
- container, runner, filesystem, or host isolation escape;
- server-side request forgery or unintended network access;
- credential, environment, command, or terminal-output exposure;
- unauthorized session persistence after logout or termination;
- denial of service that bypasses the configured resource limits.

Running arbitrary commands inside an authorized terminal is expected behavior. It becomes a vulnerability when authentication, ownership, isolation, or another documented boundary can be bypassed.

## Safe testing

Test only deployments and accounts you own or have explicit permission to assess. Do not access other people's data, persist after demonstrating impact, perform social engineering, degrade shared services, or publish exploit details before a coordinated fix.

## Deployment responsibility

The `0.2` alpha is intended for a single owner on infrastructure they control. Keep it behind HTTPS/WSS and strong access control. Configure `TERMINAL_ALLOWED_ORIGINS` with exact HTTPS origins in production. `TERMINAL_ALLOW_INSECURE_LOCALHOST` exists only for an all-loopback local deployment; never enable it for a public hostname. The owner token is accepted only by the login endpoint and exchanged for a signed, HttpOnly, SameSite cookie that is also Secure on HTTPS deployments; it must never be put in a URL or browser storage.

Docker reduces accidental host access but is not a security guarantee. In the supported resource-limited stack, the trusted gateway runs as UID 0 with only `KILL`, `SETUID`, and `SETGID`; metadata is root-only, and the token is removed from the live Node environment before any shell starts. A fixed `setpriv` launcher drops PTYs to UID/GID 10002, clears supplementary groups and inheritable/ambient capabilities, and applies `no-new-privileges`. Validate that PTY effective and permitted capability sets are zero in the deployed image. Do not expose a privileged container, the Docker socket, host files, or sensitive networks to the runner. Direct-host mode on any operating system is localhost development only, not the production security boundary.

CmdImpact persists limited session metadata in `.data/sessions.json`, but does not write terminal transcripts. Live PTYs and bounded output scrollback exist only in memory and end when the server or container restarts. The shell and commands can still write history, logs, secrets, and other files into the persistent workspace; operators must protect and remove that volume according to their own retention requirements.

Every page served beside `/api` and `/ws` shares the terminal origin and therefore must not load advertising, analytics, or other third-party runtime scripts. Optional sponsor placements are escaped static text and a link only. A future ad network requires a separate hostname/origin that is excluded from `TERMINAL_ALLOWED_ORIGINS`.
