# Changelog

This file records user-visible changes. CmdImpact has not published a stable release.

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
