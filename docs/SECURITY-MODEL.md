# Security model

## Scope

This release is a **single-owner, self-hosted alpha**. It lets one trusted owner run commands, including commands copied from AI tools, inside the configured machine or container. It is not a public multi-tenant shell service.

The owner, the host administrator, Caddy, the Node gateway, and the container runtime are trusted. Commands, terminal output, browser messages, remote downloads, and websites reached by commands are untrusted.

## Controls implemented

- The access token is accepted only by `POST /api/auth/login`. It is compared through constant-size digests and exchanged for a signed, expiring, HttpOnly, `SameSite=Strict` cookie.
- Production cookies are `Secure` and use the `__Host-` prefix. Production origins must be all HTTPS, or all loopback HTTP with the explicit localhost-only escape hatch enabled; mixed schemes are rejected.
- State-changing HTTP requests and every WebSocket upgrade require an exact origin allowlist match. Cookie validity is rechecked on each WebSocket heartbeat, and logout closes sockets that are open at that moment.
- Browser frames, request bodies, names, dimensions, connection counts, session counts, input rate, output rate, scrollback, and socket backpressure are bounded. WebSocket compression is disabled.
- Clients choose a shell identifier, never an executable or argument list. The server maps identifiers to fixed PowerShell/cmd paths on Windows and `/bin/bash` or `/bin/sh` on macOS or Linux.
- Compose supplies the access token to the trusted root gateway's initial environment. The gateway derives its verifier and removes the token from the live Node environment before creating any shell; its explicit shell environment never includes the token. Host and Docker administrators can inspect container configuration and are therefore trusted. Deployments with a real secret file can use `TERMINAL_ACCESS_TOKEN_FILE` instead.
- Terminal input and output are never written to the metadata store or application logs. Scrollback exists only in bounded process memory; metadata retention is limited to every non-exited record and the 100 newest exited records.
- The trusted container gateway runs as UID 0 with only `KILL`, `SETUID`, and `SETGID`; the metadata directory is root-only. A fixed `setpriv` launcher changes PTYs to UID/GID 10002, clears supplementary groups and inheritable/ambient capabilities, and applies `no-new-privileges`. The application filesystem is read-only, PIDs/CPU/RAM are bounded, and state and workspace use dedicated volumes.
- The default published port is loopback-only. No Docker socket, host filesystem, device, host network, or privileged mount is exposed.

These controls follow the core recommendations in the [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html). Docker also notes that containers have [no CPU or memory constraints by default](https://docs.docker.com/engine/containers/resource_constraints/), which is why the Compose limits are explicit.

## Important limitations

- Direct-host mode on Windows, macOS, or Linux executes as the host user with no isolation. Use it only on a machine and files you are willing to affect; do not expose port 8787 publicly.
- The Linux container protects the host better than direct mode, but the gateway and every PTY still share one container and outbound network. PTYs share UID/GID 10002 and the workspace, so a malicious command may read or delete workspace data, terminate other PTYs, consume its quota, or exfiltrate anything entered into the shell. The UID boundary protects the root-only gateway secret and state; it is not a tenant sandbox.
- Explicit stop and natural shell exit both clean up a Linux PTY session with `TERM` and then `KILL`, and finalization waits until that session is empty. A process that deliberately creates a new session with `setsid()` escapes this lifecycle control; do not treat the container as a hostile-code sandbox.
- The UID transition should leave PTY effective and permitted capability sets empty, but this must be verified against every released container image in addition to the unit tests.
- Container isolation is not a sufficient multi-tenant boundary for hostile strangers. Public accounts require one strongly isolated sandbox per user/session, network egress policy, quotas/billing, abuse response, audit work, and independent penetration testing. [Docker rootless mode](https://docs.docker.com/engine/security/rootless/) reduces daemon risk; [gVisor](https://gvisor.dev/docs/) adds a stronger application-kernel boundary. Neither turns this alpha into a reviewed public service by itself.
- Live PTYs survive browser disconnects only while the Node process remains alive. Metadata survives restart; processes and memory do not.
- The in-memory login limiter is suitable for one process, not a distributed deployment.
- Login cookies are stateless. Logout clears the caller's cookie and closes currently open sockets, but cannot revoke a copied cookie or cookies already issued to other devices; those remain valid until expiry or access-token rotation.
- Outbound internet is available in the container so Git, npm, and agent CLIs can work. There is no egress allowlist, malware scanner, private-network protection, or secret vault in this release.
- The server does not preinstall Claude, Codex, GitHub, or other vendor CLIs and never injects host credentials. Owner-installed files under the workspace volume persist and remain the owner's responsibility.

## Required public-host checklist

Do not make the service internet-accessible until all of these are true:

1. Put the gateway behind HTTPS/WSS and set `TERMINAL_ALLOWED_ORIGINS` to the one exact HTTPS origin.
2. Use a randomly generated access token, keep it outside Git, and restart after rotating it.
3. Set `TERMINAL_ALLOW_INSECURE_LOCALHOST=false` when using Compose.
4. Bind the gateway to a private interface; expose only the TLS reverse proxy.
5. Retain the gateway/PTY UID split, gateway-only token handling, root-only state, limited gateway capabilities, fixed `setpriv` drop, read-only filesystem, `no-new-privileges`, and resource limits. Verify the PTY has zero effective and permitted capabilities in the deployed image.
6. Back up the workspace only if the owner explicitly wants that data retained; never treat `sessions.json` as a transcript backup.
7. Re-run the automated checks and obtain an independent security review for the actual host, proxy, and container configuration.

## Reporting

Do not include access tokens, cookies, private repository data, terminal transcripts, or real commands containing secrets in a public issue. Follow the private reporting process in the repository security policy.
