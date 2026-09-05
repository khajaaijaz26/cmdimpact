# CmdImpact Roadmap

CmdImpact is being built in small, verifiable stages. This roadmap describes direction, not promised dates.

## Now: `0.2` self-hosted alpha

- Live PTY sessions in a responsive web terminal.
- Create, list, reconnect to, and terminate sessions.
- Reconnect from another browser or device while the same server process remains online.
- Guard multi-line and potentially destructive paste before it reaches the shell.
- Run terminal workloads through the documented Docker isolation boundary.
- Keep the product single-owner and self-hosted while the security model matures.

The current server keeps live PTY state in memory. Limited session metadata and workspace files may persist, but terminal processes do not survive a server restart. The alpha does not provide multi-user isolation or per-device revocation.

## Next: durable owner sessions

- Explicit device registration, session visibility, and remote device revocation.
- A durable process supervisor so approved sessions can survive application restarts.
- Encrypted persistent session metadata with clear retention and deletion controls.
- Stronger network, filesystem, resource-limit, and terminal escape-sequence testing.
- Documented backup, update, and recovery paths for self-hosters.

## Later: shared infrastructure

- Multiple users with tested tenant isolation.
- A managed cloud option.
- Scoped team access and deliberately shared sessions.
- Auditable file transfer and workspace management.
- Optional integrations with developer tools and AI assistants.

## Not promised by the alpha

CmdImpact `0.2` is not a general-purpose cloud shell, a collaboration platform, or a guarantee that containers contain every hostile workload. Features move forward only when their authentication, ownership, privacy, and isolation boundaries can be tested.
