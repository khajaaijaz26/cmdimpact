---
layout: ../../layouts/MarkdownLayout.astro
title: "Why curl pipe shell deserves a pause"
description: "A plain-English explanation of curl-to-shell installers, what the pipe changes, and how to inspect the downloaded script first."
section: "Guide"
ads: true
---

The pattern is usually written like this:

```sh
curl -fsSL https://example.com/install.sh | sh
```

It is convenient, but it combines two separate actions into one line:

1. `curl` receives data from a URL.
2. `sh` interprets the received text as commands immediately.

The [official curl manual](https://curl.se/docs/manpage.html) describes curl as a tool for transferring data to or from a server. The pipe means you may execute that transferred data without first keeping a copy for review.

## Why the source matters

The domain, path and connection are only part of the decision. The content at the URL can change after an article or AI answer is written. A redirect may also lead somewhere different from the address you first see.

Before running an installer, confirm that the URL belongs to the real project and that the project itself links to that exact installation method. A familiar-looking name is not enough.

## A more inspectable workflow

Separate the download from the decision to execute it:

```sh
curl -fL https://example.com/install.sh -o install.sh
```

Now inspect `install.sh` with a text editor. Look for package installations, administrator access, new repositories, network calls, file deletion, shell-profile changes and any request for secrets. Only choose to run the saved script if you understand the relevant actions and trust its source.

This separation does not make an unknown script safe. It simply gives you a useful review point that the one-line pipeline removes.

## What CmdImpact reports

CmdImpact labels this pattern as direct remote execution, a network download and a network action. It does not fetch the URL or decide that the publisher is trustworthy.

Paste the exact command into the [checker](/#checker) before using it. Replace real tokens or private URLs with placeholders first.
