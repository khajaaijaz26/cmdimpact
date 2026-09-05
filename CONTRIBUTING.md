# Contributing to CmdImpact

Thanks for helping build a useful, understandable web terminal. CmdImpact is a single-owner, self-hosted alpha, so focused fixes and tests are more useful than broad rewrites.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before opening an issue

- Search existing issues and discussions.
- Send suspected vulnerabilities through [private vulnerability reporting](https://github.com/khajaaijaz26/cmdimpact/security/advisories/new), never a public issue.
- Remove credentials, tokens, private hosts, usernames, file paths, personal data, and confidential terminal output.
- Use harmless commands and placeholder values in reproductions.

Use the bug form for reproducible defects and the feature form for a concrete user problem. Discuss large behavior or architecture changes before investing in an implementation.

## Local development

Requirements: Node.js 22.12 or newer, npm, and Docker for the isolated terminal runner.

```bash
git clone https://github.com/khajaaijaz26/cmdimpact.git
cd cmdimpact
npm install
npm run setup
npm start
```

Open <http://localhost:4321/app/>. The container port is bound to `127.0.0.1:4321`; `docker compose up --build` is equivalent to `npm start`.

For host development, run `npm run dev:server` and `npm run dev:ui` in separate terminals. Direct-host mode on any operating system has no Docker isolation, so use it only on a trusted machine and never expose it to another device.

## Make a focused change

1. Create a short branch from the default branch.
2. Keep the change limited to one problem.
3. Reuse existing project patterns and dependencies.
4. Add the smallest test that would fail without the behavior.
5. Update user-facing documentation when behavior or configuration changes.
6. Run the full validation before opening a pull request.

```bash
npm run validate
```

For container, proxy, or deployment changes, also run `docker compose build`.

## Terminal security rules

- Never log or add fixtures containing real commands, output, credentials, session tokens, or private infrastructure details.
- Authorize every session action; possession of a session identifier alone must not grant access.
- Treat WebSocket frames, terminal dimensions, paste content, filenames, and environment values as untrusted input.
- Do not build shell commands by interpolating request values.
- Do not weaken Docker isolation, resource limits, origin checks, or authentication for convenience.
- Keep ads, analytics, and third-party scripts out of terminal and authenticated routes.

Explain any effect on authentication, session ownership, PTY lifecycle, persistence, isolation, networking, secrets, or logs in the pull request.

## Pull requests

A useful pull request includes a linked issue or concise rationale, validation results, security and privacy impact, and sanitized screenshots for interface changes. Maintainers may ask to split unrelated work. By contributing, you agree that your contribution is licensed under the project's [Apache License 2.0](LICENSE).
