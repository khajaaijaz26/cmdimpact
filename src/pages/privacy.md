---
layout: ../layouts/MarkdownLayout.astro
title: "Privacy policy"
description: "What the CmdImpact terminal and command checker process, what is stored, and how sponsor links work."
section: "Trust center"
---

_Effective: 6 September 2026_

## Web terminal

CmdImpact is self-hosted. After you sign in, terminal input and output travel between your browser and the CmdImpact server over its WebSocket connection. Commands execute with the permissions of the configured PTY runner. Anyone operating or monitoring that host or its network termination may be able to access terminal activity; CmdImpact does not claim end-to-end encryption.

The server keeps a bounded output backlog in memory so a reconnecting browser can catch up. It does not create permanent terminal recordings or command-history files of its own. Your shell and command-line programs may still keep their own history, logs or files.

CmdImpact stores session metadata, including the session name, shell, state, timestamps and exit details, in the server's local data directory. Processes and in-memory output do not survive a server restart; previously active metadata is then marked as exited.

Authentication uses an HTTP-only browser cookie. The access token is checked by the server and is not saved to browser local storage. The terminal workspace does not load advertising or third-party analytics scripts.

## Command checker

Text entered in the standalone [command checker](/check/) is processed inside the browser tab. CmdImpact does not send it to the terminal server, a database, an AI provider or an analytics service. It remains only until it is cleared, replaced or the tab closes.

Do not paste real passwords, tokens, private keys, customer records or confidential source. Local redaction is limited and is not a data-loss-prevention product.

## Hosting

A deployed server and its network provider may process ordinary request data, such as IP address, requested URL, browser details, time and security signals, to deliver and protect the service. The operator chooses the hosting and proxy providers and is responsible for their configuration and privacy terms.

## Guide sponsorship

Optional sponsor messages may appear only on selected editorial guide pages. A placement is static text and an HTTPS link built into the page; it loads no sponsor script, tracking pixel, image or cookie. CmdImpact sends nothing to the sponsor. If you follow the link, your browser requests the sponsor's site and that site processes the request under its own privacy terms.

## Changes and contact

Material changes will update the effective date. Report a privacy concern through the [project issue tracker](https://github.com/khajaaijaz26/cmdimpact/issues) without including confidential information.
