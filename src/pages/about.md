---
layout: ../layouts/MarkdownLayout.astro
title: "About CmdImpact"
description: "Why CmdImpact keeps self-hosted terminal sessions within reach and adds a review step before risky pastes."
section: "About"
---

CmdImpact is **the terminal that follows you**: a single-owner, self-hosted web terminal for returning to shell and AI coding sessions from another browser or device.

## The product idea

Start Bash, PowerShell or another shell supported by your host, then use Claude Code, Codex, Gemini CLI or ordinary command-line tools inside it. Closing the browser detaches the session instead of immediately ending its process. Open CmdImpact again while the server is still running and reconnect to that session.

The first release keeps the model deliberately small: one owner, one server and multiple browser clients. It is not a hosted multi-user shell service, a device-mesh network or an end-to-end encrypted relay.

## Guarded paste

Terminal commands increasingly arrive through AI answers, GitHub projects and ordinary web pages. CmdImpact checks pasted text for supported install, download, delete, overwrite, elevation, network and credential patterns before sending a flagged paste to the terminal.

The guard is deterministic and runs in the browser. It is a pause for review, not proof that a command is safe. The standalone [command checker](/check/) never runs or uploads the text you enter.

## Honest session limits

Terminal processes run with the permissions of the CmdImpact server process. They can survive a browser disconnect, but they do not survive a CmdImpact server restart. Session metadata is retained so an interrupted session can be shown as exited after restart.

The source is available on [GitHub](https://github.com/khajaaijaz26/cmdimpact). Report errors without posting credentials, private commands or confidential output.
