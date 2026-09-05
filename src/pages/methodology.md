---
layout: ../layouts/MarkdownLayout.astro
title: "How CmdImpact checks a command"
description: "The supported shells, deterministic pattern checks, result language, privacy boundary and known limits behind CmdImpact."
section: "Method"
---

_Last updated: 6 September 2026_

CmdImpact performs static text analysis. It **never runs the pasted command**.

The same browser-side analysis powers both the standalone checker and the guarded-paste review inside the terminal workspace.

## Supported input

The first release recognizes common Bash/sh and PowerShell syntax, plus familiar commands from npm, npx, pnpm, yarn, pip, pipx and several system package managers. Input is capped at 50,000 characters to keep the browser check predictable.

It works best with the exact command block rather than an entire conversation.

## Checks

Each non-empty line is inspected for known patterns in these categories:

- **Install:** package installation or one-off package execution.
- **Download:** curl, wget, PowerShell web requests, Git clones and container pulls.
- **Delete:** file deletion, including forceful or recursive forms.
- **Overwrite:** output redirection, content replacement and destructive Git resets.
- **Elevation:** common administrator or root requests.
- **Network:** commands that can contact or transfer data to another system.
- **Secret:** credential-shaped literal values that could enter history, logs or process details.

A separate high-impact rule detects a download whose output is piped directly to a shell or expression evaluator.

## Result language

- **Do not run yet:** at least one known pattern can request administrator access, forcefully delete or overwrite data, directly execute downloaded content, or expose a possible password or token.
- **Check before running:** a supported pattern such as installation, download or network access was found.
- **No supported warning found:** none of the current rules matched. This is not a safety verdict.

There is no numerical score because an unexplained 92/100 would hide the decision the user actually needs to make.

## Evidence and redaction

Every finding includes the matching line and a shortened evidence string. Credential-shaped values in assignments, options, authorization headers and common token formats are replaced before appearing in the result or copied questions.

Redaction is a precaution, not a complete secret scanner. Replace real credentials and private addresses with placeholders before pasting anywhere.

## What this cannot prove

Static pattern matching cannot:

- inspect the contents returned by a URL;
- resolve shell aliases, functions, variables or environment state;
- know which directory or user account will run the command;
- understand every command-line program or scripting language;
- verify that a package publisher or remote server is trustworthy; or
- guarantee that an unmatched command is safe.

Review official documentation, inspect downloaded code, use least privilege, keep recoverable backups and test uncertain commands in an appropriate isolated environment.

## Open rules

The checker implementation and tests are published in the [CmdImpact repository](https://github.com/khajaaijaz26/cmdimpact). A new rule must identify a concrete pattern, use cautious wording and include a regression check.
