# CmdImpact Roadmap

CmdImpact is built in small, testable releases. This is direction, not a promise of dates.

## Now: `0.2.0-alpha.1`

- Deploy one static dashboard globally on Vercel with no terminal secrets or traffic in Vercel.
- Let each owner select an exact HTTPS runner and connect to it directly from any modern browser.
- Run real PowerShell, cmd, bash, or sh sessions on Windows, macOS, Linux, or the isolated Linux Docker stack.
- Create, rename, reconnect to, take control of, and end sessions across devices.
- Keep PTYs running after the browser or phone closes while the runner and host remain online; idle and hard expiry are disabled by default.
- Use a login-only owner access token and an expiring cross-site session token kept in tab-scoped storage.
- Review every non-empty paste while stating clearly that static rules cannot prove command safety.
- Offer open-tab background attention notifications without claiming closed-tab push delivery.
- Run installed Git, package, GitHub, deployment, and AI-agent CLIs through the real shell and its existing permissions.

The current runner is a single-owner boundary. Live PTYs and scrollback are in memory, so they do not survive a runner or host restart. The release does not provide multiple isolated owners, provider-managed credentials, or a hosted terminal backend.

## Next: durable owner operation

- A durable process supervisor so opted-in sessions can survive application restarts.
- Device registration, named devices, session visibility, and targeted revocation.
- Short-lived session renewal without retaining the owner access token.
- Clear update, restart, recovery, backup, and workspace-retention controls.
- Stronger proxy, origin, network, filesystem, resource-limit, and terminal escape-sequence tests.
- Optional notification delivery beyond an open browser, with an explicit privacy model.
- A runner-focused container deployment that does not bundle the local dashboard.

## Later: shared infrastructure

- Strongly isolated per-owner or per-session runtimes.
- Scoped teams and deliberately shared sessions.
- Auditable file transfer and workspace management.
- Optional managed runners without moving terminal credentials into the public static site.
- Quotas, billing controls, abuse response, egress policy, and independent penetration testing required for public accounts.

## Not promised by the alpha

CmdImpact `0.2` is not a multi-tenant cloud shell, a guarantee that containers contain hostile workloads, a command-safety oracle, or a provider integration broker. Features advance only when their authentication, ownership, privacy, cost, and isolation boundaries can be tested.
