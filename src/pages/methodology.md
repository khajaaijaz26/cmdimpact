---
layout: ../layouts/MarkdownLayout.astro
title: "How CmdImpact reviews a command"
description: "How CmdImpact reviews every paste, highlights broad command risks, protects secrets and states the limits honestly."
section: "Method"
---

_Last updated: 6 September 2026_

CmdImpact performs static text analysis. It **never runs the pasted command**.

The same browser-side analysis powers both the standalone checker and the guarded-paste review inside the terminal workspace.

## Supported input

The checker recognizes common Bash/sh and PowerShell syntax plus familiar developer, package, Git, container, cloud and system commands. Input is capped at 50,000 characters to keep the browser check predictable.

It works best with the exact command block rather than an entire conversation.

## Checks

Every non-empty paste is paused for review. Each action is inspected for known indicators including:

- **Install:** package installation or one-off package execution.
- **Download:** curl, wget, PowerShell web requests, Git clones and container pulls.
- **Delete:** file deletion, including forceful or recursive forms.
- **Overwrite:** output redirection, content replacement and destructive Git resets.
- **Elevation:** common administrator or root requests.
- **Network:** commands that can contact or transfer data to another system.
- **Secret:** credential-shaped literal values that could enter history, logs or process details.
- **Permissions and system changes:** ownership, access modes, services, scheduled tasks, disks, registry and firewall operations.
- **Dynamic execution:** inline, evaluated, decoded or encoded program text.
- **Source control and deployment:** Git history changes, production publishing, infrastructure changes and remote resource deletion.
- **Databases and containers:** destructive SQL and container options that can cross an expected isolation boundary.

A separate high-impact rule detects a download whose output is piped directly to a shell or expression evaluator. If no specific indicator matches, CmdImpact still adds a human-review item rather than treating the command as verified.

## Result language

- **Do not run yet:** at least one known pattern can request administrator access, forcefully delete or overwrite data, directly execute downloaded content, or expose a possible password or token.
- **Check before running:** at least one review item was found, including the fallback used for otherwise unclassified commands.
- **Nothing executable found:** the input did not contain an action the checker could identify.

There is no numerical score because an unexplained 92/100 would hide the decision the user actually needs to make.

## Evidence and redaction

Every finding includes the matching line and a shortened evidence string. Credential-shaped values in assignments, options, authorization headers and common token formats are replaced before appearing in the result or copied questions.

Redaction is a precaution, not a complete secret scanner. Replace real credentials and private addresses with placeholders before pasting anywhere.

## What this cannot prove

Static pattern matching still cannot:

- inspect the contents returned by a URL;
- resolve shell aliases, functions, variables or environment state;
- know which directory or user account will run the command;
- understand every command-line program or scripting language;
- verify that a package publisher or remote server is trustworthy; or
- guarantee that any command is safe, even when all displayed items look expected.

Review official documentation, inspect downloaded code, use least privilege, keep recoverable backups and test uncertain commands in an appropriate isolated environment.

## Open rules

The checker implementation and tests are published in the [CmdImpact repository](https://github.com/khajaaijaz26/cmdimpact). A new rule must identify a concrete pattern, use cautious wording and include a regression check.
